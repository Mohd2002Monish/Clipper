# VideoTimmer: Video Splitter & Reframer Web Application

A full-stack, enterprise-grade video reframing, blur-background fitting, multi-part splitting, text overlaying, and Google Drive delivery platform.

## Architecture

Built strictly following the specification in `requirement.txt`:

- **Frontend & API**: Next.js 14 (App Router) + Tailwind CSS + Lucide Icons
- **Worker**: Standalone BullMQ Background Queue Consumer (`src/worker/index.ts`)
- **Video Engine**: FFmpeg + FFprobe with Noto Font Suite (Devanagari, Urdu, Arabic, CJK, Emoji support)
- **Database**: MongoDB 7 (Jobs, Parts, Settings, LogIndex)
- **Cache & Queue**: Redis 7
- **Logging**: Section 8 16-channel JSON Lines logger with redaction & per-job aggregation
- **Packaging**: Multi-stage Docker Compose setup (`Dockerfile.api`, `Dockerfile.worker`, `docker-compose.yml`)

## Directory Layout

```
├── Dockerfile.api           # Next.js API server container with FFmpeg & Noto fonts
├── Dockerfile.worker        # Background rendering worker container with FFmpeg & Noto fonts
├── docker-compose.yml       # Orchestrates api, worker, redis, mongo, and shared volumes
├── logs/                    # Section 8 JSON Lines log directory
├── storage/                 # Temporary working directories
│   ├── uploads/             # Chunked incoming videos
│   ├── work/                # Working directory per job (<jobId>)
│   └── outputs/             # Verified rendered parts (<jobId>)
├── src/
│   ├── app/                 # Next.js App Router (UI & API routes)
│   │   ├── api/health/      # Comprehensive /api/health endpoint
│   │   ├── globals.css      # Dark theme & glassmorphism styling
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Multi-screen Dashboard & wizard UI
│   ├── lib/
│   │   ├── config.ts        # Centralized configuration manager
│   │   ├── db.ts            # MongoDB connection & health check
│   │   ├── redis.ts         # Redis connection & health check
│   │   ├── queue.ts         # BullMQ render queue management
│   │   ├── system.ts        # FFmpeg/FFprobe detection & disk stats
│   │   └── logger/          # Section 8 16-channel JSON Lines logger
│   ├── models/              # Mongoose schemas (Job, Part, Setting, LogIndex)
│   ├── shared/              # Zod validation schemas & TypeScript types
│   └── worker/              # Background rendering worker entrypoint
└── package.json
```

## Automated Mac Setup (New Machine Migration)

When transferring this repository to a new or different Mac via GitHub:

### Option 1: 1-Click Setup via macOS Finder (Recommended)
1. Clone or extract the repository on your new Mac.
2. In Finder, double-click **`Setup-VideoTimmer.command`**.
3. The script will automatically:
   - Detect your Mac architecture (Apple Silicon M1/M2/M3/M4 or Intel)
   - Check and install Apple Command Line Tools & Homebrew (if missing)
   - Install and configure Node.js (v20+) and NPM
   - Install `ffmpeg-full` with all audio/video codecs and subtitle drawtext filters
   - Install and start Redis (`redis://127.0.0.1:6379`)
   - Install and start MongoDB Community Server (`mongodb://127.0.0.1:27017`)
   - Create local working directories (`storage/uploads`, `storage/work`, `storage/outputs`, `logs`)
   - Auto-generate a fresh `.env` with secure encryption secrets and binary paths
   - Run `npm install` for all dependencies
   - Configure all desktop launcher permissions

### Option 2: Setup via Terminal
```bash
# Make the setup script executable and run it
chmod +x setup-mac.sh
./setup-mac.sh
```

---

## Running the Application

### 1-Click Desktop Launcher
- Double-click **`Launch-VideoTimmer.command`** in Finder to launch the web server and background rendering worker simultaneously.
- Double-click **`Stop-VideoTimmer.command`** in Finder whenever you want to stop all background processes.

### Terminal Mode
```bash
# Start Web UI and Background BullMQ Rendering Worker concurrently:
npm run dev

# Or launch as desktop mode:
npm run desktop

# Stop desktop background services:
npm run desktop:stop
```

Access the dashboard at `http://localhost:3000`.
Health check endpoint: `http://localhost:3000/api/health`.



{
  "mcpServers": {
    "videotimmer": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
