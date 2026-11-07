// VideoTimmer IDM Popup Controller - V2

document.addEventListener('DOMContentLoaded', async () => {
  const activeUrlEl = document.getElementById('activeUrl');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const btnDownloadLocal = document.getElementById('btnDownloadLocal');
  const btnUploadDrive = document.getElementById('btnUploadDrive');
  const qualitySelect = document.getElementById('qualitySelect');
  const folderSelect = document.getElementById('folderSelect');
  const serverUrlInput = document.getElementById('serverUrlInput');
  const feedbackMsg = document.getElementById('feedbackMsg');
  const progressBarWrap = document.getElementById('progressBarWrap');
  const progressBarFill = document.getElementById('progressBarFill');
  const btnToggleLogs = document.getElementById('btnToggleLogs');
  const logsBox = document.getElementById('logsBox');
  const linkDashboard = document.getElementById('linkDashboard');

  let currentUrl = '';

  // 1. Load preferences
  const settings = await chrome.storage.local.get({
    serverUrl: 'http://localhost:3000',
    defaultFolder: 'Shorts',
    defaultQuality: 'best',
  });

  serverUrlInput.value = settings.serverUrl;
  folderSelect.value = settings.defaultFolder;
  qualitySelect.value = settings.defaultQuality;
  linkDashboard.href = `${settings.serverUrl.replace(/\/+$/, '')}/?tab=clip-ingest`;

  // Event Listeners for settings
  qualitySelect.addEventListener('change', () => {
    chrome.storage.local.set({ defaultQuality: qualitySelect.value });
  });

  folderSelect.addEventListener('change', () => {
    chrome.storage.local.set({ defaultFolder: folderSelect.value });
  });

  serverUrlInput.addEventListener('change', () => {
    const val = serverUrlInput.value.trim() || 'http://localhost:3000';
    chrome.storage.local.set({ serverUrl: val });
    linkDashboard.href = `${val.replace(/\/+$/, '')}/?tab=clip-ingest`;
    checkStatus();
  });

  // 2. Query active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      currentUrl = tab.url;
      activeUrlEl.textContent = currentUrl;
      activeUrlEl.title = currentUrl;
    } else {
      activeUrlEl.textContent = 'No active video page detected';
    }
  } catch {
    activeUrlEl.textContent = 'Could not read tab URL';
  }

  // 3. Status Check
  async function checkStatus() {
    try {
      const server = (serverUrlInput.value || 'http://localhost:3000').replace(/\/+$/, '');
      const res = await fetch(`${server}/api/health`, { method: 'GET' });
      if (res.ok) {
        statusBadge.className = 'status-badge';
        statusText.textContent = 'Mac Engine Ready';
      } else {
        throw new Error('Not ready');
      }
    } catch {
      statusBadge.className = 'status-badge offline';
      statusText.textContent = 'Mac Engine Offline';
    }
  }

  checkStatus();

  function showFeedback(text, isSuccess) {
    feedbackMsg.textContent = text;
    feedbackMsg.className = `feedback-msg ${isSuccess ? 'success' : 'error'}`;
    setTimeout(() => {
      feedbackMsg.className = 'feedback-msg';
    }, 4000);
  }

  // 4. Download Local Action with Polling
  btnDownloadLocal.addEventListener('click', async () => {
    if (!currentUrl) {
      showFeedback('No video URL found on current tab', false);
      return;
    }

    btnDownloadLocal.disabled = true;
    btnDownloadLocal.textContent = 'Starting...';
    progressBarWrap.style.display = 'block';
    progressBarFill.style.width = '10%';

    chrome.runtime.sendMessage(
      {
        action: 'START_JOB',
        url: currentUrl,
        quality: qualitySelect.value,
        target: 'local',
      },
      (startRes) => {
        if (!startRes || !startRes.success || !startRes.jobId) {
          btnDownloadLocal.disabled = false;
          btnDownloadLocal.textContent = 'Download Local';
          progressBarWrap.style.display = 'none';
          showFeedback('Failed to start download job', false);
          return;
        }

        const jobId = startRes.jobId;

        const pollInterval = setInterval(() => {
          chrome.runtime.sendMessage({ action: 'POLL_JOB', jobId }, (pollRes) => {
            if (!pollRes || !pollRes.success) {
              clearInterval(pollInterval);
              btnDownloadLocal.disabled = false;
              btnDownloadLocal.textContent = 'Download Local';
              progressBarWrap.style.display = 'none';
              showFeedback('Error checking job status', false);
              return;
            }

            if (pollRes.status === 'downloading') {
              const pct = pollRes.percent || 15;
              progressBarFill.style.width = `${pct}%`;
              btnDownloadLocal.textContent = `Downloading ${pct}%...`;
            } else if (pollRes.status === 'ready') {
              clearInterval(pollInterval);
              progressBarFill.style.width = '100%';
              btnDownloadLocal.textContent = 'Saving file...';

              chrome.runtime.sendMessage(
                { action: 'TRIGGER_BROWSER_DOWNLOAD', downloadUrl: pollRes.downloadUrl },
                () => {
                  btnDownloadLocal.disabled = false;
                  btnDownloadLocal.textContent = 'Download Local';
                  progressBarWrap.style.display = 'none';
                  showFeedback(`Saved to Downloads (${pollRes.resolution || '1080p'})`, true);
                }
              );
            } else if (pollRes.status === 'error') {
              clearInterval(pollInterval);
              btnDownloadLocal.disabled = false;
              btnDownloadLocal.textContent = 'Download Local';
              progressBarWrap.style.display = 'none';
              showFeedback(`Error: ${pollRes.error || 'Failed'}`, false);
            }
          });
        }, 1000);
      }
    );
  });

  // 5. Upload to Drive Action
  btnUploadDrive.addEventListener('click', async () => {
    if (!currentUrl) {
      showFeedback('No video URL found on current tab', false);
      return;
    }

    btnUploadDrive.disabled = true;
    btnUploadDrive.textContent = 'Staging to Drive...';
    progressBarWrap.style.display = 'block';
    progressBarFill.style.width = '10%';

    chrome.runtime.sendMessage(
      {
        action: 'START_JOB',
        url: currentUrl,
        quality: qualitySelect.value,
        target: 'drive',
        targetFolder: folderSelect.value,
        notes: 'Queued via Extension Popup',
      },
      (startRes) => {
        if (!startRes || !startRes.success || !startRes.jobId) {
          btnUploadDrive.disabled = false;
          btnUploadDrive.textContent = 'Save to Google Drive';
          progressBarWrap.style.display = 'none';
          showFeedback('Failed to start Drive staging', false);
          return;
        }

        const jobId = startRes.jobId;

        const pollInterval = setInterval(() => {
          chrome.runtime.sendMessage({ action: 'POLL_JOB', jobId }, (pollRes) => {
            if (!pollRes || !pollRes.success) {
              clearInterval(pollInterval);
              btnUploadDrive.disabled = false;
              btnUploadDrive.textContent = 'Save to Google Drive';
              progressBarWrap.style.display = 'none';
              showFeedback('Error checking Drive job', false);
              return;
            }

            if (pollRes.status === 'downloading' || pollRes.status === 'uploading_drive') {
              const pct = pollRes.percent || 40;
              progressBarFill.style.width = `${pct}%`;
              btnUploadDrive.textContent = pollRes.progressText || 'Processing...';
            } else if (pollRes.status === 'ready') {
              clearInterval(pollInterval);
              progressBarFill.style.width = '100%';
              btnUploadDrive.disabled = false;
              btnUploadDrive.textContent = 'Save to Google Drive';
              progressBarWrap.style.display = 'none';
              showFeedback(`Staged in Drive / ${folderSelect.value}`, true);
            } else if (pollRes.status === 'error') {
              clearInterval(pollInterval);
              btnUploadDrive.disabled = false;
              btnUploadDrive.textContent = 'Save to Google Drive';
              progressBarWrap.style.display = 'none';
              showFeedback(`Error: ${pollRes.error || 'Drive staging failed'}`, false);
            }
          });
        }, 1000);
      }
    );
  });

  // 6. View Logs Toggle
  btnToggleLogs.addEventListener('click', () => {
    if (logsBox.style.display === 'block') {
      logsBox.style.display = 'none';
      btnToggleLogs.textContent = 'View Logs';
    } else {
      logsBox.style.display = 'block';
      btnToggleLogs.textContent = 'Hide Logs';
      logsBox.textContent = 'Fetching logs from engine...';

      chrome.runtime.sendMessage({ action: 'FETCH_LOGS' }, (res) => {
        if (res && res.success && res.logs && res.logs.length > 0) {
          logsBox.textContent = res.logs.slice(-25).join('\n');
          logsBox.scrollTop = logsBox.scrollHeight;
        } else {
          logsBox.textContent = 'No log entries recorded yet in logs/idm_extension.log';
        }
      });
    }
  });
});
