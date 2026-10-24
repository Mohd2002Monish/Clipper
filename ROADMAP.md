# VideoTimmer: Future Features & Product Roadmap

This document outlines upcoming planned capabilities, postponed features, and technical specifications for future development phases so that no ideas or requirements are lost.

---

## 1. Speech-to-Text & Subtitle Engine (Postponed for Next Phase)

### 1.1 Local Whisper Speech-to-Text (Offline & Zero-Cost)
- **Engine**: Native integration with `whisper.cpp` (`whisper-cli`) leveraging Apple Silicon Metal GPU acceleration.
- **Benefits**:
  - 100% offline processing without recurring API fees or token limits.
  - Zero latency data transfer (audio never leaves the local machine).
  - High accuracy across multilingual audio (Hindi, English, Spanish, Urdu, Arabic, and more).
- **Model Tiers**:
  - `ggml-tiny.bin` / `ggml-base.bin`: Ultra-fast generation for draft subtitles.
  - `ggml-small.bin` / `ggml-medium.bin`: Production-grade precision for social clips.

### 1.2 Interactive Subtitle & SRT Editor UI
- In-browser subtitle review and live text editing before committing to video rendering.
- Drag-and-drop timeline adjustment for subtitle start and end timestamps.
- One-click export to standalone `.srt` and `.vtt` formats.

### 1.3 Animated Caption Styles (Karaoke & Viral Motion)
- **Word-Level Highlighting**: Dynamic word-by-word active color transitions (Hormozi style).
- **Preset Typography Themes**:
  - Viral Bold (high-contrast yellow/white on dark background with drop shadow)
  - Minimalist Documentary (subtle sans-serif with blurred background plate)
  - Creator Dynamic (auto-zooming key words and emphasis badges)

---

## 2. AI Video Intelligence & Auto-Clipping

### 2.1 Audio Energy & Peak Engagement Detection
- Analyze audio volume levels, pitch fluctuations, and laughter/applause bursts to automatically identify the most viral 30 to 60-second moments from 1-hour+ long-form podcasts and streams.

### 2.2 Active Speaker Tracking (Smart Reframe)
- Computer-vision-assisted speaker detection using facial bounding boxes.
- Smooth camera panning to keep the active speaker centered when reframing horizontal 16:9 interview footage into 9:16 vertical Shorts and Reels.

---

## 3. Audio Post-Production & Sound Design

### 3.1 Automatic Audio Ducking
- Seamlessly lower background music volume whenever voice narration is detected, returning music volume to normal levels during speech pauses.

### 3.2 Voice Isolation & Noise Removal
- Built-in FFmpeg audio filter pipelines (`afftdn`, `highpass`, `lowpass`, `compand`) to eliminate room echo, air conditioning hum, and microphone pops.

---

## 4. Multi-Platform Syndication & Publishing

### 4.1 Native Social Connectors
- Direct 1-click scheduling and publishing to:
  - YouTube Shorts (via Google YouTube Data API v3)
  - Instagram Reels (via Meta Graph API)
  - TikTok Videos (via TikTok Content Posting API)
  - Threads Video Posts

### 4.2 Audience Retention & Schedule Optimization
- Historical performance sync to suggest ideal publishing windows for peak viewer engagement.

---

## 5. Storage & Cloud Provider Integrations

- Ingestion and export support beyond Google Drive:
  - AWS S3 / Cloudflare R2 object storage
  - Dropbox and OneDrive sync
  - Direct local network storage (NAS / SMB shared drives)

---

## Feature Priority Matrix

| Phase | Feature Name | Core Tech | Status |
| :--- | :--- | :--- | :--- |
| Phase 2 | Local Whisper Speech-to-Text | whisper.cpp, Metal | Planned |
| Phase 2 | Subtitle SRT Visual Timeline Editor | Next.js, Canvas | Planned |
| Phase 2 | Word-by-Word Animated Captions | FFmpeg drawtext/ass | Planned |
| Phase 3 | AI Viral Moment Clipping | Audio Energy, FFprobe | Backlog |
| Phase 3 | Active Speaker Tracking | OpenCV, FFmpeg crop | Backlog |
| Phase 3 | Smart Audio Ducking & Cleanup | FFmpeg af_sidechain | Backlog |
| Phase 4 | Direct TikTok & Reels Syndication | OAuth2, Graph APIs | Backlog |
| Phase 4 | Cloudflare R2 / S3 Ingestion | S3 SDK | Backlog |
