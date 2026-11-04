# Clip Ingest Mobile (React Native / Expo)

Native mobile application for sharing video links directly from YouTube, YouTube Shorts, and Instagram Reels into your Google Drive Ingestion Queue.

## Features

- **Native Share Sheet Integration**: Tap "Share" on any YouTube or Instagram video and select **Clip Ingest**.
- **Drive Folder Selection**: Live dropdown selector to pick which Google Drive folder the clip should be staged in.
- **Clipboard Detection**: One-tap paste from your phone's clipboard.
- **Real-Time Staging Status**: Shows when the clip is `Pending`, `Mac Downloading`, or `Uploaded to Drive`.
- **Configurable Server**: Change your Vercel deployment URL anytime in Settings.

## Getting Started

1. Navigate to this directory:
   ```bash
   cd services/clip-queue-mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. Scan the QR code using **Expo Go** on your iPhone or Android phone, or press `a` for Android Emulator / `i` for iOS Simulator.

5. Open Settings inside the app (gear icon in the top right) and enter your Vercel server URL (e.g. `https://clip-queue-server.vercel.app` or your local computer's network IP `http://192.168.x.x:3001`).

