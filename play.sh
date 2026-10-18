#!/usr/bin/env sh
# ==================================================================
#  Open World 3D - one-click launcher for macOS and Linux
#  - rebuilds index1.html only if it is missing (needs Node.js)
#  - starts a tiny local server so mouse capture + sound work
#  - prefers Node.js, falls back to Python 3, then opens the file
#  Nothing is installed or downloaded automatically.
# ==================================================================
cd "$(dirname "$0")" || exit 1

open_url() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1; then
    open "$1" >/dev/null 2>&1
  fi
}

open_later() {
  ( sleep 1; open_url "http://127.0.0.1:8123/index1.html" ) &
}

if [ ! -f index1.html ]; then
  if command -v node >/dev/null 2>&1; then
    echo "[*] index1.html is missing - building it from source..."
    node _build2/build.js || exit 1
  else
    echo "[X] index1.html is missing and Node.js was not found."
    echo "    Re-download the project, or install Node.js from https://nodejs.org"
    exit 1
  fi
fi

if command -v node >/dev/null 2>&1; then
  open_later
  echo "[*] Starting the local server with Node.js on http://127.0.0.1:8123"
  echo "    The game opens in your browser in a moment. Press Ctrl+C to stop the server."
  exec node _build2/serve.js
elif command -v python3 >/dev/null 2>&1; then
  open_later
  echo "[*] Starting the local server with Python on http://127.0.0.1:8123"
  echo "    The game opens in your browser in a moment. Press Ctrl+C to stop the server."
  exec python3 -m http.server 8123
else
  echo "[i] Neither Node.js nor Python 3 was found - opening index1.html directly."
  echo "    For the best experience (mouse capture and sound) install Node.js from https://nodejs.org"
  open_url "index1.html"
fi
