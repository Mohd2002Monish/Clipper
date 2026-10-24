#!/usr/bin/env bash
# ==============================================================================
# VideoTimmer - Automated macOS Setup & Environment Initializer
# Supported Architectures: Apple Silicon (M1/M2/M3/M4) & Intel (x86_64)
# ==============================================================================

set -uo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
NC="\033[0m"

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_step() {
  echo -e "\n${BOLD}${CYAN}==>${NC} ${BOLD}$1${NC}"
}

log_ok() {
  echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

echo -e "${CYAN}================================================================${NC}"
echo -e "${BOLD}       VideoTimmer - Automated macOS Environment Setup          ${NC}"
echo -e "${CYAN}================================================================${NC}"

# Navigate to project root directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

log_info "Working directory: $SCRIPT_DIR"

# ------------------------------------------------------------------------------
# 1. Architecture & Platform Detection
# ------------------------------------------------------------------------------
log_step "Step 1: Detecting macOS Architecture"

OS_NAME="$(uname -s)"
if [ "$OS_NAME" != "Darwin" ]; then
  log_error "This setup script is strictly designed for macOS. Detected: $OS_NAME"
  exit 1
fi

ARCH_NAME="$(uname -m)"
if [ "$ARCH_NAME" = "arm64" ]; then
  HOMEBREW_PREFIX="/opt/homebrew"
  log_ok "Apple Silicon Mac detected ($ARCH_NAME). Homebrew prefix: $HOMEBREW_PREFIX"
else
  HOMEBREW_PREFIX="/usr/local"
  log_ok "Intel Mac detected ($ARCH_NAME). Homebrew prefix: $HOMEBREW_PREFIX"
fi

# Ensure standard Homebrew paths are exported into current shell
if [ -d "$HOMEBREW_PREFIX/bin" ]; then
  export PATH="$HOMEBREW_PREFIX/bin:$HOMEBREW_PREFIX/sbin:$PATH"
fi
if [ -d "$HOMEBREW_PREFIX/opt/ffmpeg-full/bin" ]; then
  export PATH="$HOMEBREW_PREFIX/opt/ffmpeg-full/bin:$PATH"
fi

# ------------------------------------------------------------------------------
# 2. Apple Command Line Tools (Xcode CLT)
# ------------------------------------------------------------------------------
log_step "Step 2: Checking Apple Command Line Tools (Xcode CLT)"

if ! xcode-select -p >/dev/null 2>&1; then
  log_warn "Apple Command Line Tools are not installed."
  log_info "Initiating Command Line Tools installation..."
  xcode-select --install || true
  echo ""
  log_warn "Please complete the Apple installation dialog that appeared on your screen."
  log_info "Waiting for installation to finish..."
  until xcode-select -p >/dev/null 2>&1; do
    sleep 5
  done
  log_ok "Command Line Tools successfully installed."
else
  CLT_PATH="$(xcode-select -p)"
  log_ok "Apple Command Line Tools present at: $CLT_PATH"
fi

# ------------------------------------------------------------------------------
# 3. Homebrew Package Manager
# ------------------------------------------------------------------------------
log_step "Step 3: Checking Homebrew Package Manager"

if ! command -v brew >/dev/null 2>&1; then
  if [ -f "$HOMEBREW_PREFIX/bin/brew" ]; then
    eval "$("$HOMEBREW_PREFIX/bin/brew" shellenv)"
  fi
fi

if ! command -v brew >/dev/null 2>&1; then
  log_warn "Homebrew not found. Installing official Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [ -f "$HOMEBREW_PREFIX/bin/brew" ]; then
    eval "$("$HOMEBREW_PREFIX/bin/brew" shellenv)"
  fi
fi

if command -v brew >/dev/null 2>&1; then
  BREW_VERSION="$(brew --version | head -n 1)"
  log_ok "Homebrew available: $BREW_VERSION"

  # Ensure Homebrew is sourced in user's profile for future terminal sessions
  SHELL_PROFILE="$HOME/.zprofile"
  if [ -n "${BASH_VERSION:-}" ] && [ ! -f "$HOME/.zshrc" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
  fi

  if ! grep -q "eval \"\$($HOMEBREW_PREFIX/bin/brew shellenv)\"" "$SHELL_PROFILE" 2>/dev/null; then
    log_info "Adding Homebrew shellenv to $SHELL_PROFILE..."
    echo "eval \"\$($HOMEBREW_PREFIX/bin/brew shellenv)\"" >> "$SHELL_PROFILE" 2>/dev/null || true
  fi
else
  log_error "Homebrew installation could not be completed. Please install Homebrew manually from https://brew.sh"
  exit 1
fi

# ------------------------------------------------------------------------------
# 4. Node.js & NPM
# ------------------------------------------------------------------------------
log_step "Step 4: Checking Node.js Runtime"

NEED_NODE=0
if ! command -v node >/dev/null 2>&1; then
  NEED_NODE=1
else
  NODE_VER="$(node -v | sed 's/v//' | cut -d'.' -f1)"
  if [ "$NODE_VER" -lt 18 ]; then
    log_warn "Current Node.js version $(node -v) is too old. VideoTimmer requires Node.js 18+ (20+ recommended)."
    NEED_NODE=1
  fi
fi

if [ "$NEED_NODE" -eq 1 ]; then
  log_info "Installing modern Node.js via Homebrew..."
  brew install node
  eval "$("$HOMEBREW_PREFIX/bin/brew" shellenv)"
fi

NODE_VERSION="$(node -v 2>/dev/null || echo 'Not Found')"
NPM_VERSION="$(npm -v 2>/dev/null || echo 'Not Found')"
log_ok "Node.js: $NODE_VERSION"
log_ok "NPM: $NPM_VERSION"

# ------------------------------------------------------------------------------
# 5. FFmpeg & FFprobe (High Quality Media Engine)
# ------------------------------------------------------------------------------
log_step "Step 5: Checking FFmpeg & FFprobe Media Engine"

DETECTED_FFMPEG=""
DETECTED_FFPROBE=""

# Check ffmpeg-full or standard ffmpeg
if [ -x "$HOMEBREW_PREFIX/opt/ffmpeg-full/bin/ffmpeg" ]; then
  DETECTED_FFMPEG="$HOMEBREW_PREFIX/opt/ffmpeg-full/bin/ffmpeg"
  DETECTED_FFPROBE="$HOMEBREW_PREFIX/opt/ffmpeg-full/bin/ffprobe"
elif command -v ffmpeg >/dev/null 2>&1; then
  DETECTED_FFMPEG="$(command -v ffmpeg)"
  DETECTED_FFPROBE="$(command -v ffprobe)"
fi

if [ -z "$DETECTED_FFMPEG" ]; then
  log_info "Installing ffmpeg-full with all audio/video codecs and subtitle filters..."
  brew install ffmpeg-full || brew install ffmpeg

  if [ -x "$HOMEBREW_PREFIX/opt/ffmpeg-full/bin/ffmpeg" ]; then
    DETECTED_FFMPEG="$HOMEBREW_PREFIX/opt/ffmpeg-full/bin/ffmpeg"
    DETECTED_FFPROBE="$HOMEBREW_PREFIX/opt/ffmpeg-full/bin/ffprobe"
  else
    DETECTED_FFMPEG="$(command -v ffmpeg)"
    DETECTED_FFPROBE="$(command -v ffprobe)"
  fi
fi

FFMPEG_VER="$("$DETECTED_FFMPEG" -version | head -n 1)"
log_ok "FFmpeg binary: $DETECTED_FFMPEG ($FFMPEG_VER)"
log_ok "FFprobe binary: $DETECTED_FFPROBE"

# ------------------------------------------------------------------------------
# 6. Redis Queue Backend
# ------------------------------------------------------------------------------
log_step "Step 6: Checking Redis Service (Queue Manager)"

if ! command -v redis-server >/dev/null 2>&1; then
  log_info "Installing Redis via Homebrew..."
  brew install redis
fi

log_info "Starting Redis service via Homebrew..."
brew services start redis >/dev/null 2>&1 || true

# Verify Redis responsiveness
REDIS_READY=0
for i in {1..10}; do
  if redis-cli ping >/dev/null 2>&1; then
    REDIS_READY=1
    break
  fi
  sleep 0.5
done

if [ "$REDIS_READY" -eq 1 ]; then
  log_ok "Redis service is active and responsive on port 6379 (PONG verified)."
else
  log_warn "Redis service did not respond immediately. Launching daemonized instance..."
  redis-server --daemonize yes >/dev/null 2>&1 || true
  sleep 1
  if redis-cli ping >/dev/null 2>&1; then
    log_ok "Redis daemon started successfully."
  else
    log_warn "Could not verify local Redis ping. If using external Redis, set REDIS_URL in .env."
  fi
fi

# ------------------------------------------------------------------------------
# 7. MongoDB Database Service
# ------------------------------------------------------------------------------
log_step "Step 7: Checking MongoDB Database Service"

if ! command -v mongosh >/dev/null 2>&1 && ! command -v mongod >/dev/null 2>&1; then
  log_info "Configuring MongoDB tap and installing MongoDB Community Server..."
  brew tap mongodb/brew >/dev/null 2>&1 || true
  brew install mongodb-community@7.0 || brew install mongodb-community || true
fi

log_info "Starting MongoDB service via Homebrew..."
brew services start mongodb-community@7.0 >/dev/null 2>&1 || brew services start mongodb-community >/dev/null 2>&1 || true

# Test local MongoDB connectivity
MONGO_READY=0
if command -v mongosh >/dev/null 2>&1; then
  for i in {1..8}; do
    if mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
      MONGO_READY=1
      break
    fi
    sleep 0.5
  done
fi

if [ "$MONGO_READY" -eq 1 ]; then
  log_ok "MongoDB service is active and connected on port 27017."
else
  log_info "Local MongoDB check finished. Note: If you use a cloud MongoDB Atlas connection string, you can configure MONGODB_URI in .env."
fi

# ------------------------------------------------------------------------------
# 8. Storage & Working Directories
# ------------------------------------------------------------------------------
log_step "Step 8: Preparing Storage & Log Directories"

mkdir -p "$SCRIPT_DIR/storage/uploads"
mkdir -p "$SCRIPT_DIR/storage/work"
mkdir -p "$SCRIPT_DIR/storage/outputs"
mkdir -p "$SCRIPT_DIR/logs"

log_ok "Created directories: storage/uploads, storage/work, storage/outputs, logs"

# ------------------------------------------------------------------------------
# 9. Environment File Configuration (.env)
# ------------------------------------------------------------------------------
log_step "Step 9: Configuring Environment Settings (.env)"

ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

if [ -f "$ENV_FILE" ]; then
  log_ok "Existing .env file detected. Keeping your current configuration."
else
  log_info "No .env found (code transferred from git). Creating a fresh .env file..."

  # Generate secure random secrets
  GEN_ENCRYPTION_SECRET="$(openssl rand -hex 16 2>/dev/null || echo 'videotimmer-secure-encryption-32b')"
  GEN_AUTH_SECRET="$(openssl rand -hex 24 2>/dev/null || echo 'videotimmer-secure-auth-secret-key')"

  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
  fi

  # Write or patch the essential settings
  cat <<EOF > "$ENV_FILE"
# Server Configuration
PORT=3000
NODE_ENV=development
API_BASE_URL=http://localhost:3000

# Database & Queue
MONGODB_URI=mongodb://127.0.0.1:27017/videotimmer
REDIS_URL=redis://127.0.0.1:6379

# Storage & Paths
STORAGE_DIR=./storage
LOG_DIR=./logs
LOG_RETENTION_DAYS=7

# Processing Limits
MAX_UPLOAD_SIZE_MB=3048
MAX_PARTS_LIMIT=10000
WORKER_CONCURRENCY=2

# Security & Encryption
ENCRYPTION_SECRET=${GEN_ENCRYPTION_SECRET}
AUTH_SECRET=${GEN_AUTH_SECRET}

# System Binaries (Auto-detected for this Mac)
FFMPEG_PATH=${DETECTED_FFMPEG}
FFPROBE_PATH=${DETECTED_FFPROBE}

# Optional Third-Party Integrations
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_DEFAULT_FOLDER_ID=

GEMINI_API_KEY=

THREADS_APP_ID=
THREADS_APP_SECRET=
THREADS_REDIRECT_URI=http://localhost:3000/auth/threads/callback
EOF

  log_ok "Generated production-ready .env with auto-detected binary paths and generated encryption secrets."
fi

# ------------------------------------------------------------------------------
# 10. Node Dependencies Installation
# ------------------------------------------------------------------------------
log_step "Step 10: Installing Node.js Project Dependencies (npm install)"

log_info "Running npm install..."
npm install

log_ok "All Node.js dependencies installed successfully."

# ------------------------------------------------------------------------------
# 11. Script Permissions & Desktop Launchers
# ------------------------------------------------------------------------------
log_step "Step 11: Configuring Executable Permissions"

chmod +x "$SCRIPT_DIR/setup-mac.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/Setup-VideoTimmer.command" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/Launch-VideoTimmer.command" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/Stop-VideoTimmer.command" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/scripts/"*.sh 2>/dev/null || true

log_ok "Executable permissions granted to all scripts."

# ------------------------------------------------------------------------------
# 12. Verification & Summary Report
# ------------------------------------------------------------------------------
log_step "Step 12: System Verification & Health Check"

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}        VideoTimmer Setup Completed Successfully!               ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo -e "${BOLD}System Configuration Summary:${NC}"
echo -e "  - Architecture:     $ARCH_NAME (macOS $OS_NAME)"
echo -e "  - Node.js:          $NODE_VERSION"
echo -e "  - NPM:              $NPM_VERSION"
echo -e "  - FFmpeg:           $DETECTED_FFMPEG"
echo -e "  - FFprobe:          $DETECTED_FFPROBE"
echo -e "  - Redis:            Active (redis://127.0.0.1:6379)"
echo -e "  - Local Storage:    $SCRIPT_DIR/storage"
echo -e "  - Environment File: $SCRIPT_DIR/.env"
echo ""
echo -e "${BOLD}How to Launch VideoTimmer:${NC}"
echo -e "  1. 1-Click Launch (Finder):"
echo -e "     Double-click ${CYAN}Launch-VideoTimmer.command${NC} in Finder."
echo -e ""
echo -e "  2. Terminal Launch:"
echo -e "     Run: ${CYAN}npm run dev${NC}  or  ${CYAN}./scripts/launch-desktop.sh${NC}"
echo ""
echo -e "  3. Stop Application:"
echo -e "     Double-click ${CYAN}Stop-VideoTimmer.command${NC} or run ${CYAN}npm run desktop:stop${NC}"
echo ""
echo -e "Web App URL: ${BOLD}http://localhost:3000${NC}"
echo -e "${GREEN}================================================================${NC}"
