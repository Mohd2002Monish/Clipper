#!/bin/bash
# VideoTimmer 1-Click Desktop Launcher for macOS

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

mkdir -p logs

PID_FILE="$DIR/.videotimmer.pids"
APP_PORT=3000
URL="http://localhost:$APP_PORT"

# Ensure standard Homebrew paths are in PATH
if [ -d "/opt/homebrew/bin" ]; then
  export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
fi
if [ -d "/usr/local/bin" ]; then
  export PATH="/usr/local/bin:/usr/local/sbin:$PATH"
fi
if [ -d "/opt/homebrew/opt/ffmpeg-full/bin" ]; then
  export PATH="/opt/homebrew/opt/ffmpeg-full/bin:$PATH"
fi
if [ -d "/usr/local/opt/ffmpeg-full/bin" ]; then
  export PATH="/usr/local/opt/ffmpeg-full/bin:$PATH"
fi

echo "[VideoTimmer] Checking services..."

# 1. Check / Start Redis if available locally
if command -v redis-cli >/dev/null 2>&1; then
  if ! redis-cli ping >/dev/null 2>&1; then
    echo "[VideoTimmer] Starting local Redis..."
    if command -v brew >/dev/null 2>&1; then
      brew services start redis >/dev/null 2>&1
    elif command -v redis-server >/dev/null 2>&1; then
      redis-server --daemonize yes >/dev/null 2>&1
    fi
  fi
fi

# 2. Check / Start MongoDB if available locally
if command -v mongosh >/dev/null 2>&1 || command -v mongo >/dev/null 2>&1; then
  if ! mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo "[VideoTimmer] Starting local MongoDB..."
    if command -v brew >/dev/null 2>&1; then
      brew services start mongodb-community@7.0 >/dev/null 2>&1 || brew services start mongodb-community >/dev/null 2>&1
    fi
  fi
fi

# 2. Check if Next.js is already running on port 3000
APP_RUNNING=0
if lsof -Pi :$APP_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  APP_RUNNING=1
  echo "[VideoTimmer] Web server is already running on port $APP_PORT"
else
  echo "[VideoTimmer] Starting Web server on port $APP_PORT..."
  npm run dev:web > logs/app.log 2>&1 &
  APP_PID=$!
  echo "APP_PID=$APP_PID" > "$PID_FILE"
fi

# 3. Check if Worker is running
WORKER_RUNNING=0
if pgrep -f "src/worker/index.ts" >/dev/null 2>&1; then
  WORKER_RUNNING=1
  echo "[VideoTimmer] Rendering worker is already active."
else
  echo "[VideoTimmer] Starting background rendering worker..."
  npm run worker > logs/worker.log 2>&1 &
  WORKER_PID=$!
  echo "WORKER_PID=$WORKER_PID" >> "$PID_FILE"
fi

# 4. Wait for web server to become ready (up to 15 seconds)
echo "[VideoTimmer] Waiting for application to initialize..."
READY=0
for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" "$URL" | grep -q "200\|304\|307\|308"; then
    READY=1
    break
  fi
  sleep 0.5
done

# 5. Open in standalone Desktop Window mode (looks and feels like native .app / .exe)
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BRAVE_PATH="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
EDGE_PATH="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"

if [ -f "$CHROME_PATH" ]; then
  "$CHROME_PATH" --app="$URL" >/dev/null 2>&1 &
elif [ -f "$BRAVE_PATH" ]; then
  "$BRAVE_PATH" --app="$URL" >/dev/null 2>&1 &
elif [ -f "$EDGE_PATH" ]; then
  "$EDGE_PATH" --app="$URL" >/dev/null 2>&1 &
else
  open "$URL"
fi

# 6. Post desktop notification
osascript -e 'display notification "VideoTimmer Studio is ready." with title "VideoTimmer Desktop"' >/dev/null 2>&1

echo "[VideoTimmer] Ready at $URL"
