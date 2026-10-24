#!/bin/bash
# VideoTimmer Stopper script for macOS

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

PID_FILE="$DIR/.videotimmer.pids"
APP_PORT=3000

# Ensure standard Homebrew paths are in PATH
if [ -d "/opt/homebrew/bin" ]; then
  export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
fi
if [ -d "/usr/local/bin" ]; then
  export PATH="/usr/local/bin:/usr/local/sbin:$PATH"
fi

echo "[VideoTimmer] Stopping services..."

# 1. Kill tracked PIDs if recorded
if [ -f "$PID_FILE" ]; then
  # shellcheck disable=SC1090
  source "$PID_FILE"
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null
  fi
  if [ -n "$WORKER_PID" ] && kill -0 "$WORKER_PID" 2>/dev/null; then
    kill "$WORKER_PID" 2>/dev/null
  fi
  rm -f "$PID_FILE"
fi

# 2. Ensure port 3000 is freed
PORT_PID=$(lsof -ti :$APP_PORT 2>/dev/null)
if [ -n "$PORT_PID" ]; then
  kill "$PORT_PID" 2>/dev/null
fi

# 3. Stop any background worker tsx processes
pkill -f "src/worker/index.ts" 2>/dev/null

osascript -e 'display notification "Web server and rendering worker have stopped." with title "VideoTimmer Stopped"' >/dev/null 2>&1

echo "[VideoTimmer] All services successfully stopped."
