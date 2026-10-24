#!/bin/bash
# ==============================================================================
# VideoTimmer 1-Click macOS Installer & Setup Launcher
# Double-click this file from macOS Finder to set up all system dependencies.
# ==============================================================================

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

chmod +x "$DIR/setup-mac.sh" 2>/dev/null || true
bash "$DIR/setup-mac.sh"

echo ""
echo "------------------------------------------------------------------"
echo "Installation process complete. Press any key to close this window."
echo "------------------------------------------------------------------"
read -n 1 -s
