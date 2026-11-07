// VideoTimmer IDM Video Downloader Content Script - V3 (Full Universal Web Sniffer)

(function () {
  let selectedQuality = 'best'; // default max quality
  let selectedDriveFolder = 'Shorts';
  let detectedStreams = [];

  const SVG_ICONS = {
    download: `<svg class="vt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    drive: `<svg class="vt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
    folder: `<svg class="vt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
    chevronDown: `<svg class="vt-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    check: `<svg class="vt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    spinner: `<svg class="vt-icon vt-spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    alert: `<svg class="vt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  // 1. Live stream receiver from background service worker
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'MEDIA_STREAM_DETECTED' && msg.stream) {
        if (!detectedStreams.some((s) => s.url === msg.stream.url)) {
          if (msg.stream.type === 'hls' || msg.stream.url.includes('master') || msg.stream.url.includes('.m3u8')) {
            detectedStreams.unshift(msg.stream);
          } else {
            detectedStreams.push(msg.stream);
          }
        }
      }
    });

    // Request initial streams for current tab
    chrome.runtime.sendMessage({ action: 'GET_DETECTED_STREAMS' }, (res) => {
      if (res && res.streams && res.streams.length > 0) {
        detectedStreams = res.streams;
      }
    });
  } catch {}

  /**
   * Sniffs recent media stream URLs (.m3u8, .mpd, .mp4) from the browser Performance API
   */
  function findPerformanceStream() {
    try {
      const resources = performance.getEntriesByType('resource');
      for (let i = resources.length - 1; i >= 0; i--) {
        const name = resources[i].name;
        if (!name || !name.startsWith('http')) continue;
        const clean = name.split('?')[0].toLowerCase();
        if (clean.endsWith('.m3u8') || name.includes('.m3u8?') || name.includes('master.m3u8') || name.includes('playlist.m3u8')) {
          return name;
        }
        if (clean.endsWith('.mpd') || name.includes('.mpd?') || name.includes('manifest.mpd')) {
          return name;
        }
        if (clean.endsWith('.mp4') || clean.endsWith('.webm') || name.includes('.mp4?') || name.includes('videoplayback')) {
          return name;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Resolves canonical URL or direct media stream of current video element
   */
  function resolveVideoUrl(video) {
    const pageUrl = window.location.href;

    // 1. Instagram
    if (pageUrl.includes('instagram.com')) {
      if (pageUrl.includes('/reel/') || pageUrl.includes('/p/')) {
        return pageUrl.split('?')[0];
      }
      const container = video.closest('article') || video.closest('div[role="dialog"]') || video.closest('main') || video.parentElement;
      const reelLink = container ? container.querySelector('a[href*="/reel/"], a[href*="/p/"]') : null;
      if (reelLink && reelLink.href) {
        return reelLink.href.split('?')[0];
      }
      return pageUrl.split('?')[0];
    }

    // 2. YouTube
    if (pageUrl.includes('youtube.com') || pageUrl.includes('youtu.be')) {
      if (pageUrl.includes('/shorts/') || pageUrl.includes('/watch')) {
        return pageUrl;
      }
      const itemContainer = video.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-reel-video-renderer');
      const thumbLink = itemContainer ? itemContainer.querySelector('a#thumbnail, a[href*="/shorts/"], a[href*="/watch"]') : null;
      if (thumbLink && thumbLink.href) {
        return thumbLink.href;
      }
      return pageUrl;
    }

    // 3. Facebook
    if (pageUrl.includes('facebook.com') || pageUrl.includes('fb.watch')) {
      if (pageUrl.includes('/watch') || pageUrl.includes('/reel/') || pageUrl.includes('/videos/')) {
        return pageUrl;
      }
      const container = video.closest('[role="article"]') || video.closest('div[data-pagelet*="FeedUnit"]') || video.closest('div');
      const fbLink = container ? container.querySelector('a[href*="/watch"], a[href*="/reel/"], a[href*="/videos/"]') : null;
      if (fbLink && fbLink.href) {
        return fbLink.href;
      }
      return pageUrl;
    }

    // 4. Twitter / X
    if (pageUrl.includes('x.com') || pageUrl.includes('twitter.com')) {
      const tweet = video.closest('article');
      const tweetLink = tweet ? tweet.querySelector('a[href*="/status/"]') : null;
      if (tweetLink && tweetLink.href) {
        return tweetLink.href;
      }
      return pageUrl;
    }

    // 5. TikTok
    if (pageUrl.includes('tiktok.com')) {
      const videoCard = video.closest('[data-e2e="feed-item"], [data-e2e="recommend-list-item"]');
      const link = videoCard ? videoCard.querySelector('a[href*="/video/"]') : null;
      if (link && link.href) return link.href;
      return pageUrl;
    }

    // 6. Reddit
    if (pageUrl.includes('reddit.com')) {
      const post = video.closest('shreddit-post, div[data-testid="post-container"]');
      const permalink = post ? (post.getAttribute('permalink') || post.querySelector('a[data-click-id="body"]')?.href) : null;
      if (permalink) {
        return permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`;
      }
      return pageUrl;
    }

    // 7. Generic Video Sites / HTML5 / Streaming / Blob (Full IDM Mode)
    // Direct HTTP src on video element or source tags
    const directSrc = video.currentSrc || video.src || video.querySelector('source')?.src;
    if (directSrc && directSrc.startsWith('http') && !directSrc.startsWith('blob:')) {
      return directSrc;
    }

    // Direct HTTP stream detected via WebRequest sniffer
    if (detectedStreams.length > 0) {
      return detectedStreams[0].url;
    }

    // Direct HTTP stream detected via Performance resource timings
    const perfStream = findPerformanceStream();
    if (perfStream) {
      return perfStream;
    }

    // Fallback: Current page URL (yt-dlp generic extractor will inspect)
    return pageUrl;
  }

  function getPositioningContainer(video) {
    if (window.location.hostname.includes('youtube.com')) {
      const shortsPlayer = video.closest('#player-container') || video.closest('ytd-reel-video-renderer');
      if (shortsPlayer) return shortsPlayer;
      const watchPlayer = video.closest('.html5-video-player');
      if (watchPlayer) return watchPlayer;
    }

    if (window.location.hostname.includes('instagram.com')) {
      const parent = video.parentElement;
      if (parent) {
        const computed = window.getComputedStyle(parent);
        if (computed.position === 'static') {
          parent.style.position = 'relative';
        }
        return parent;
      }
    }

    const parent = video.parentElement || video;
    if (parent) {
      const computed = window.getComputedStyle(parent);
      if (computed.position === 'static') {
        parent.style.position = 'relative';
      }
    }
    return parent;
  }

  function attachIdmBadge(video) {
    if (video.dataset.vtAttached === 'true') return;
    video.dataset.vtAttached = 'true';

    if (video.clientWidth < 100 || video.clientHeight < 100) {
      return;
    }

    const container = getPositioningContainer(video);
    if (!container || container.querySelector('.vt-idm-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'vt-idm-overlay';

    overlay.innerHTML = `
      <div class="vt-controls-row">
        <button type="button" class="vt-btn-download" title="Download 1080p/4K MP4 to Local PC (IDM Mode)">
          ${SVG_ICONS.download}
          <span class="vt-btn-text">Download</span>
        </button>

        <button type="button" class="vt-btn-quality" title="Change Video Quality">
          <span class="vt-quality-label">Max</span>
          ${SVG_ICONS.chevronDown}
        </button>

        <button type="button" class="vt-btn-drive" title="Upload directly to Google Drive">
          ${SVG_ICONS.drive}
          <span class="vt-drive-text">Drive</span>
        </button>

        <button type="button" class="vt-btn-folder" title="Select target folder for Drive">
          ${SVG_ICONS.chevronDown}
        </button>
      </div>

      <div class="vt-progress-container">
        <div class="vt-progress-fill"></div>
      </div>

      <!-- Error Toast for Clear Feedback -->
      <div class="vt-error-toast" style="display: none;"></div>

      <!-- Quality Menu -->
      <div class="vt-dropdown-menu vt-quality-menu">
        <div class="vt-menu-title">Download Quality</div>
        <button type="button" class="vt-menu-item vt-active" data-quality="best">
          <span>Max Quality</span>
          <span class="vt-menu-badge">4K / Best</span>
        </button>
        <button type="button" class="vt-menu-item" data-quality="1080p">
          <span>1080p</span>
          <span class="vt-menu-badge">Full HD</span>
        </button>
        <button type="button" class="vt-menu-item" data-quality="720p">
          <span>720p</span>
          <span class="vt-menu-badge">HD</span>
        </button>
        <button type="button" class="vt-menu-item" data-quality="audio">
          <span>Audio Only</span>
          <span class="vt-menu-badge">MP3</span>
        </button>
      </div>

      <!-- Folder Menu -->
      <div class="vt-dropdown-menu vt-folder-menu">
        <div class="vt-menu-title">Target Drive Folder</div>
        <button type="button" class="vt-menu-item ${selectedDriveFolder === 'Shorts' ? 'vt-active' : ''}" data-folder="Shorts">
          ${SVG_ICONS.folder} Shorts
        </button>
        <button type="button" class="vt-menu-item ${selectedDriveFolder === 'Movie-Vault' ? 'vt-active' : ''}" data-folder="Movie-Vault">
          ${SVG_ICONS.folder} Movie-Vault
        </button>
        <button type="button" class="vt-menu-item ${selectedDriveFolder === 'GTA-5' ? 'vt-active' : ''}" data-folder="GTA-5">
          ${SVG_ICONS.folder} GTA-5
        </button>
        <button type="button" class="vt-menu-item ${selectedDriveFolder === 'General' ? 'vt-active' : ''}" data-folder="General">
          ${SVG_ICONS.folder} General
        </button>
      </div>
    `;

    // Elements
    const btnDownload = overlay.querySelector('.vt-btn-download');
    const btnQuality = overlay.querySelector('.vt-btn-quality');
    const labelQuality = overlay.querySelector('.vt-quality-label');
    const menuQuality = overlay.querySelector('.vt-quality-menu');
    const btnDrive = overlay.querySelector('.vt-btn-drive');
    const btnFolder = overlay.querySelector('.vt-btn-folder');
    const menuFolder = overlay.querySelector('.vt-folder-menu');
    const progressContainer = overlay.querySelector('.vt-progress-container');
    const progressFill = overlay.querySelector('.vt-progress-fill');
    const errorToast = overlay.querySelector('.vt-error-toast');

    // Helper: Show Error Toast
    const showError = (message) => {
      if (!errorToast) return;
      errorToast.textContent = message;
      errorToast.style.display = 'block';
      setTimeout(() => {
        if (errorToast) errorToast.style.display = 'none';
      }, 5500);
    };

    // Dimming logic
    let dimTimer = null;
    const resetDimTimer = () => {
      overlay.classList.remove('vt-dimmed');
      clearTimeout(dimTimer);
      dimTimer = setTimeout(() => {
        if (!video.paused && !overlay.matches(':hover') && !menuQuality.classList.contains('vt-open') && !menuFolder.classList.contains('vt-open')) {
          overlay.classList.add('vt-dimmed');
        }
      }, 3500);
    };

    video.addEventListener('play', resetDimTimer);
    video.addEventListener('mousemove', resetDimTimer);
    overlay.addEventListener('mouseenter', () => {
      overlay.classList.remove('vt-dimmed');
      clearTimeout(dimTimer);
    });
    overlay.addEventListener('mouseleave', resetDimTimer);

    // Close menus helper
    const closeMenus = () => {
      menuQuality.classList.remove('vt-open');
      menuFolder.classList.remove('vt-open');
    };

    // Quality toggle
    btnQuality.addEventListener('click', (e) => {
      e.stopPropagation();
      menuFolder.classList.remove('vt-open');
      menuQuality.classList.toggle('vt-open');
    });

    overlay.querySelectorAll('.vt-quality-menu .vt-menu-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedQuality = item.dataset.quality || 'best';
        overlay.querySelectorAll('.vt-quality-menu .vt-menu-item').forEach((i) => i.classList.remove('vt-active'));
        item.classList.add('vt-active');
        labelQuality.textContent = selectedQuality === 'best' ? 'Max' : selectedQuality.toUpperCase();
        closeMenus();
      });
    });

    // Folder toggle
    btnFolder.addEventListener('click', (e) => {
      e.stopPropagation();
      menuQuality.classList.remove('vt-open');
      menuFolder.classList.toggle('vt-open');
    });

    overlay.querySelectorAll('.vt-folder-menu .vt-menu-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedDriveFolder = item.dataset.folder || 'Shorts';
        overlay.querySelectorAll('.vt-folder-menu .vt-menu-item').forEach((i) => i.classList.remove('vt-active'));
        item.classList.add('vt-active');
        closeMenus();
      });
    });

    document.addEventListener('click', closeMenus);

    // 1. Download Local Flow with Live Polling
    btnDownload.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      closeMenus();

      const targetUrl = resolveVideoUrl(video);
      btnDownload.disabled = true;
      btnDownload.innerHTML = `${SVG_ICONS.spinner} <span class="vt-btn-text">Starting...</span>`;
      progressContainer.classList.add('vt-visible');
      progressFill.style.width = '5%';

      chrome.runtime.sendMessage(
        {
          action: 'START_JOB',
          url: targetUrl,
          quality: selectedQuality,
          target: 'local',
          referer: window.location.href,
        },
        (startRes) => {
          if (!startRes || !startRes.success || !startRes.jobId) {
            const errorMsg = startRes?.error || 'Could not connect to VideoTimmer engine (http://localhost:3000). Please ensure VideoTimmer app is running.';
            btnDownload.title = `Error: ${errorMsg}`;
            btnDownload.innerHTML = `${SVG_ICONS.alert} <span class="vt-btn-text">Failed</span>`;
            progressContainer.classList.remove('vt-visible');
            showError(errorMsg);
            setTimeout(() => {
              btnDownload.disabled = false;
              btnDownload.title = 'Download 1080p/4K MP4 to Local PC';
              btnDownload.innerHTML = `${SVG_ICONS.download} <span class="vt-btn-text">Download</span>`;
            }, 4500);
            return;
          }

          const jobId = startRes.jobId;

          // Poll job status every 1 second
          const pollInterval = setInterval(() => {
            chrome.runtime.sendMessage({ action: 'POLL_JOB', jobId }, (pollRes) => {
              if (!pollRes || !pollRes.success) {
                clearInterval(pollInterval);
                btnDownload.innerHTML = `${SVG_ICONS.alert} <span class="vt-btn-text">Error</span>`;
                progressContainer.classList.remove('vt-visible');
                showError('Lost connection to VideoTimmer backend.');
                setTimeout(() => {
                  btnDownload.disabled = false;
                  btnDownload.innerHTML = `${SVG_ICONS.download} <span class="vt-btn-text">Download</span>`;
                }, 3500);
                return;
              }

              if (pollRes.status === 'downloading') {
                const pct = pollRes.percent || 0;
                progressFill.style.width = `${Math.max(pct, 10)}%`;
                const shortProg = pct > 0 ? `${pct}%` : 'Downloading...';
                btnDownload.innerHTML = `${SVG_ICONS.spinner} <span class="vt-btn-text">${shortProg}</span>`;
              } else if (pollRes.status === 'merging') {
                progressFill.style.width = '90%';
                btnDownload.innerHTML = `${SVG_ICONS.spinner} <span class="vt-btn-text">Merging MP4...</span>`;
              } else if (pollRes.status === 'ready') {
                clearInterval(pollInterval);
                progressFill.style.width = '100%';
                btnDownload.innerHTML = `${SVG_ICONS.check} <span class="vt-btn-text">Saving...</span>`;

                chrome.runtime.sendMessage(
                  { action: 'TRIGGER_BROWSER_DOWNLOAD', downloadUrl: pollRes.downloadUrl },
                  () => {
                    btnDownload.innerHTML = `${SVG_ICONS.check} <span class="vt-btn-text">Completed</span>`;
                    setTimeout(() => {
                      progressContainer.classList.remove('vt-visible');
                      progressFill.style.width = '0%';
                      btnDownload.disabled = false;
                      btnDownload.innerHTML = `${SVG_ICONS.download} <span class="vt-btn-text">Download</span>`;
                    }, 3500);
                  }
                );
              } else if (pollRes.status === 'error') {
                clearInterval(pollInterval);
                progressContainer.classList.remove('vt-visible');
                const errMsg = pollRes.error || 'Video extraction failed. If video is DRM-protected or requires login, try playing the video for a few seconds first.';
                btnDownload.title = `Error: ${errMsg}`;
                btnDownload.innerHTML = `${SVG_ICONS.alert} <span class="vt-btn-text">Failed</span>`;
                showError(errMsg);
                setTimeout(() => {
                  btnDownload.disabled = false;
                  btnDownload.title = 'Download 1080p/4K MP4 to Local PC';
                  btnDownload.innerHTML = `${SVG_ICONS.download} <span class="vt-btn-text">Download</span>`;
                }, 5000);
              }
            });
          }, 1000);
        }
      );
    });

    // 2. Drive Upload Flow with Live Polling
    btnDrive.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      closeMenus();

      const targetUrl = resolveVideoUrl(video);
      btnDrive.disabled = true;
      btnDrive.innerHTML = `${SVG_ICONS.spinner} <span class="vt-drive-text">Starting...</span>`;
      progressContainer.classList.add('vt-visible');
      progressFill.style.width = '5%';

      chrome.runtime.sendMessage(
        {
          action: 'START_JOB',
          url: targetUrl,
          quality: selectedQuality,
          target: 'drive',
          targetFolder: selectedDriveFolder,
          notes: `Ingested from ${window.location.hostname}`,
          referer: window.location.href,
        },
        (startRes) => {
          if (!startRes || !startRes.success || !startRes.jobId) {
            const errorMsg = startRes?.error || 'Could not connect to VideoTimmer engine (http://localhost:3000)';
            btnDrive.title = `Error: ${errorMsg}`;
            btnDrive.innerHTML = `${SVG_ICONS.alert} <span class="vt-drive-text">Failed</span>`;
            progressContainer.classList.remove('vt-visible');
            showError(errorMsg);
            setTimeout(() => {
              btnDrive.disabled = false;
              btnDrive.title = 'Upload directly to Google Drive';
              btnDrive.innerHTML = `${SVG_ICONS.drive} <span class="vt-drive-text">Drive</span>`;
            }, 4500);
            return;
          }

          const jobId = startRes.jobId;

          const pollInterval = setInterval(() => {
            chrome.runtime.sendMessage({ action: 'POLL_JOB', jobId }, (pollRes) => {
              if (!pollRes || !pollRes.success) {
                clearInterval(pollInterval);
                btnDrive.innerHTML = `${SVG_ICONS.alert} <span class="vt-drive-text">Error</span>`;
                progressContainer.classList.remove('vt-visible');
                showError('Lost connection to VideoTimmer backend.');
                setTimeout(() => {
                  btnDrive.disabled = false;
                  btnDrive.innerHTML = `${SVG_ICONS.drive} <span class="vt-drive-text">Drive</span>`;
                }, 3500);
                return;
              }

              if (pollRes.status === 'downloading') {
                const pct = pollRes.percent || 0;
                progressFill.style.width = `${Math.max(pct, 10)}%`;
                const label = pct > 0 ? `${pct}%` : 'Downloading...';
                btnDrive.innerHTML = `${SVG_ICONS.spinner} <span class="vt-drive-text">${label}</span>`;
              } else if (pollRes.status === 'uploading_drive') {
                progressFill.style.width = '85%';
                btnDrive.innerHTML = `${SVG_ICONS.spinner} <span class="vt-drive-text">Uploading Drive...</span>`;
              } else if (pollRes.status === 'ready') {
                clearInterval(pollInterval);
                progressFill.style.width = '100%';
                btnDrive.innerHTML = `${SVG_ICONS.check} <span class="vt-drive-text">Saved</span>`;
                setTimeout(() => {
                  progressContainer.classList.remove('vt-visible');
                  progressFill.style.width = '0%';
                  btnDrive.disabled = false;
                  btnDrive.innerHTML = `${SVG_ICONS.drive} <span class="vt-drive-text">Drive</span>`;
                }, 3500);
              } else if (pollRes.status === 'error') {
                clearInterval(pollInterval);
                progressContainer.classList.remove('vt-visible');
                const errMsg = pollRes.error || 'Drive upload failed. Please verify Google Drive is connected in Settings.';
                btnDrive.title = `Error: ${errMsg}`;
                btnDrive.innerHTML = `${SVG_ICONS.alert} <span class="vt-drive-text">Failed</span>`;
                showError(errMsg);
                setTimeout(() => {
                  btnDrive.disabled = false;
                  btnDrive.title = 'Upload directly to Google Drive';
                  btnDrive.innerHTML = `${SVG_ICONS.drive} <span class="vt-drive-text">Drive</span>`;
                }, 5000);
              }
            });
          }, 1000);
        }
      );
    });

    container.appendChild(overlay);
  }

  function scanVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      if (video.readyState >= 1) {
        attachIdmBadge(video);
      } else {
        video.addEventListener('loadedmetadata', () => attachIdmBadge(video), { once: true });
        video.addEventListener('play', () => attachIdmBadge(video), { once: true });
      }
    });
  }

  scanVideos();

  const observer = new MutationObserver(() => scanVideos());
  observer.observe(document.body, { childList: true, subtree: true });

  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(scanVideos, 600);
    }
  }).observe(document, { subtree: true, childList: true });
})();
