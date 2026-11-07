// VideoTimmer IDM Background Service Worker (Manifest V3)
// Full IDM-Grade Stream Interception & WebRequest Sniffer

const DEFAULT_SERVER_URL = 'http://localhost:3000';

// In-memory registry of detected media streams per browser tab
// tabId -> Array<{ url, type: 'hls'|'dash'|'mp4'|'video', contentType, size, timestamp }>
const tabMediaStreams = new Map();

// 1. WebRequest Sniffer: Intercepts all media streams (.m3u8, .mpd, .mp4, video/*)
chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    if (!details.tabId || details.tabId < 0) return;
    const url = details.url;
    if (!url || !url.startsWith('http')) return;

    // Filter out obvious trackers / ads / analytics
    if (
      url.includes('google-analytics') ||
      url.includes('/pagead/') ||
      url.includes('/analytics/') ||
      url.includes('doubleclick.net')
    ) {
      return;
    }

    let isMedia = false;
    let mediaType = 'video';
    let contentType = '';
    let contentLength = 0;

    if (details.responseHeaders) {
      for (const h of details.responseHeaders) {
        const name = (h.name || '').toLowerCase();
        if (name === 'content-type') {
          contentType = (h.value || '').toLowerCase();
        } else if (name === 'content-length') {
          contentLength = parseInt(h.value, 10) || 0;
        }
      }
    }

    // Check Content-Type header
    if (
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/x-mpegurl')
    ) {
      isMedia = true;
      mediaType = 'hls';
    } else if (contentType.includes('application/dash+xml')) {
      isMedia = true;
      mediaType = 'dash';
    } else if (contentType.includes('video/')) {
      isMedia = true;
      mediaType = contentType.includes('mp4') ? 'mp4' : 'video';
    }

    // Check URL extension patterns
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.m3u8') || url.includes('.m3u8?') || url.includes('/playlist.m3u8')) {
      isMedia = true;
      mediaType = 'hls';
    } else if (cleanUrl.endsWith('.mpd') || url.includes('.mpd?') || url.includes('/manifest.mpd')) {
      isMedia = true;
      mediaType = 'dash';
    } else if (
      cleanUrl.endsWith('.mp4') ||
      cleanUrl.endsWith('.webm') ||
      cleanUrl.endsWith('.m4v') ||
      url.includes('.mp4?') ||
      url.includes('videoplayback') ||
      url.includes('googlevideo.com/videoplayback')
    ) {
      isMedia = true;
      mediaType = 'mp4';
    }

    if (isMedia) {
      // Discard microscopic chunks (< 40KB) unless it's an HLS or DASH manifest
      if (contentLength > 0 && contentLength < 40000 && mediaType !== 'hls' && mediaType !== 'dash') {
        return;
      }

      let streams = tabMediaStreams.get(details.tabId);
      if (!streams) {
        streams = [];
        tabMediaStreams.set(details.tabId, streams);
      }

      if (!streams.some((s) => s.url === url)) {
        const isMaster = url.includes('master') || url.includes('.m3u8') || url.includes('.mpd');
        const entry = {
          url,
          type: mediaType,
          contentType: contentType || 'video/mp4',
          contentLength,
          timestamp: Date.now(),
        };

        if (isMaster) {
          streams.unshift(entry);
        } else {
          streams.push(entry);
        }

        if (streams.length > 25) {
          streams.pop();
        }

        // Notify active tab content script
        try {
          chrome.tabs.sendMessage(details.tabId, {
            action: 'MEDIA_STREAM_DETECTED',
            stream: entry,
          }).catch(() => {});
        } catch {}
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Clean up tab streams on close/navigation
chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaStreams.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabMediaStreams.delete(tabId);
  }
});

// Register Context Menus on Install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'vt-download-local',
    title: 'Download Video to Local (Max Quality)',
    contexts: ['page', 'link', 'video'],
  });

  chrome.contextMenus.create({
    id: 'vt-save-drive',
    title: 'Save Video to Google Drive',
    contexts: ['page', 'link', 'video'],
  });
});

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const targetUrl = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;
  if (!targetUrl) return;

  const settings = await chrome.storage.local.get({ serverUrl: DEFAULT_SERVER_URL });
  const server = settings.serverUrl.replace(/\/+$/, '');

  if (info.menuItemId === 'vt-download-local') {
    startAndWatchJob({ url: targetUrl, quality: 'best', target: 'local', referer: tab?.url }, server);
  } else if (info.menuItemId === 'vt-save-drive') {
    startAndWatchJob({ url: targetUrl, quality: 'best', target: 'drive', targetFolder: 'Shorts', referer: tab?.url }, server);
  }
});

// Helper for context menu jobs
async function startAndWatchJob(params, server) {
  try {
    const res = await fetch(`${server}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!data.success || !data.jobId) return;

    // Poll until ready
    const pollInterval = setInterval(async () => {
      try {
        const pollRes = await fetch(`${server}/api/download?jobId=${data.jobId}`);
        const pollData = await pollRes.json();
        if (pollData.status === 'ready') {
          clearInterval(pollInterval);
          if (params.target === 'local' && pollData.downloadUrl) {
            await chrome.downloads.download({
              url: `${server}${pollData.downloadUrl}`,
              conflictAction: 'uniquify',
            });
          }
        } else if (pollData.status === 'error') {
          clearInterval(pollInterval);
        }
      } catch {
        clearInterval(pollInterval);
      }
    }, 1200);
  } catch (err) {
    console.error('[VideoTimmer IDM ContextMenu Error]', err);
  }
}

// Runtime Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Query detected media streams for current tab
  if (message.action === 'GET_DETECTED_STREAMS') {
    const tabId = sender.tab?.id;
    const streams = tabId ? (tabMediaStreams.get(tabId) || []) : [];
    sendResponse({ success: true, streams });
    return true;
  }

  if (message.action === 'START_JOB') {
    (async () => {
      try {
        const settings = await chrome.storage.local.get({ serverUrl: DEFAULT_SERVER_URL });
        const server = settings.serverUrl.replace(/\/+$/, '');
        const refererUrl = message.referer || sender.tab?.url || '';

        const res = await fetch(`${server}/api/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: message.url,
            quality: message.quality || 'best',
            target: message.target || 'local',
            targetFolder: message.targetFolder || 'Shorts',
            notes: message.notes || '',
            referer: refererUrl,
          }),
        });

        const data = await res.json();
        sendResponse(data);
      } catch (err) {
        const errorMsg = err.message && err.message.includes('fetch')
          ? 'Cannot connect to VideoTimmer backend (http://localhost:3000). Please ensure the web server is running.'
          : (err.message || 'Unknown network error');
        sendResponse({ success: false, error: errorMsg });
      }
    })();
    return true;
  }

  if (message.action === 'POLL_JOB') {
    (async () => {
      try {
        const settings = await chrome.storage.local.get({ serverUrl: DEFAULT_SERVER_URL });
        const server = settings.serverUrl.replace(/\/+$/, '');

        const res = await fetch(`${server}/api/download?jobId=${message.jobId}`);
        const data = await res.json();
        sendResponse(data);
      } catch (err) {
        const errorMsg = err.message && err.message.includes('fetch')
          ? 'Cannot connect to VideoTimmer backend (http://localhost:3000). Please ensure the web server is running.'
          : (err.message || 'Unknown network error');
        sendResponse({ success: false, error: errorMsg });
      }
    })();
    return true;
  }

  if (message.action === 'TRIGGER_BROWSER_DOWNLOAD') {
    (async () => {
      try {
        const settings = await chrome.storage.local.get({ serverUrl: DEFAULT_SERVER_URL });
        const server = settings.serverUrl.replace(/\/+$/, '');
        const fullUrl = message.downloadUrl.startsWith('http')
          ? message.downloadUrl
          : `${server}${message.downloadUrl}`;

        await chrome.downloads.download({
          url: fullUrl,
          conflictAction: 'uniquify',
          saveAs: false,
        });

        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'FETCH_LOGS') {
    (async () => {
      try {
        const settings = await chrome.storage.local.get({ serverUrl: DEFAULT_SERVER_URL });
        const server = settings.serverUrl.replace(/\/+$/, '');
        const res = await fetch(`${server}/api/download?logs=true`);
        const data = await res.json();
        sendResponse(data);
      } catch (err) {
        const errorMsg = err.message && err.message.includes('fetch')
          ? 'Cannot connect to VideoTimmer backend (http://localhost:3000). Please ensure the web server is running.'
          : (err.message || 'Unknown network error');
        sendResponse({ success: false, error: errorMsg });
      }
    })();
    return true;
  }

  if (message.action === 'CHECK_SERVER_STATUS') {
    (async () => {
      try {
        const settings = await chrome.storage.local.get({ serverUrl: DEFAULT_SERVER_URL });
        const server = settings.serverUrl.replace(/\/+$/, '');
        const res = await fetch(`${server}/api/health`, { method: 'GET' });
        sendResponse({ isOnline: res.ok, status: res.status });
      } catch {
        sendResponse({ isOnline: false });
      }
    })();
    return true;
  }
});
