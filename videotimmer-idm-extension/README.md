# VideoTimmer IDM Video Downloader Extension

A high-performance Manifest V3 browser extension for Brave, Chrome, Edge, and Chromium browsers that brings Internet Download Manager (IDM) style floating video download buttons to Instagram Reels, YouTube Shorts, Threads, and Web Videos.

## Features

1. **Floating Video Badge (IDM Mode)**:
   - Automatically appears in the top-right corner of any playing video on Instagram, YouTube, Threads, Twitter/X, and web video players.
   - Gently dims to 35% opacity while watching, brightening to 100% on mouse hover.
2. **Direct Local Download (Primary)**:
   - Clicking "Download" passes the video stream through VideoTimmer's local `yt-dlp` and `ffmpeg` engine on your Mac.
   - Merges high-definition 1080p video with pristine audio.
   - Saves the MP4 file directly into your computer's `~/Downloads` directory via native browser download manager.
3. **Google Drive Staging (Optional)**:
   - Clicking "Drive" stages the video directly into your chosen Google Drive folder (`Shorts`, `Movie-Vault`, `GTA-5`, `General`).
   - Automatically indexes the clip in your VideoTimmer Data Table (`http://localhost:3000/?tab=clip-ingest`).
4. **Context Menus & Toolbar Popup**:
   - Right-click any link or video: "Download Video to Local (IDM)" or "Save Video to Google Drive".
   - Extension toolbar popup displaying active URL, engine health status, and quick folder selection.

## Installation in 30 Seconds

1. Open your Chromium browser (Brave, Chrome, Edge, Arc).
2. In the address bar, go to:
   - For Brave: `brave://extensions`
   - For Chrome: `chrome://extensions`
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left.
5. Select this folder from your disk:
   `/Users/mohd2002monish/Documents/ScloudIN/VideoTimmer/videotimmer-idm-extension`
6. Pin the VideoTimmer IDM extension icon to your browser toolbar.

## How to Test

1. Ensure your local VideoTimmer app is running (`npm run dev` at `http://localhost:3000`).
2. Open any Instagram Reel or YouTube Short in a new tab.
3. Hover over the video: you will see the floating pill in the top-right corner:
   - Click **Download** to save the 1080p MP4 directly to your Mac `~/Downloads`.
   - Click **Drive** to stage it to Google Drive.

