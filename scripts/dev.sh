#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi

# Run backend (FastAPI) and frontend (Next.js) together.
# Auto-picks the next free port starting from 8000 / 3000 — override with
# BACKEND_PORT=… FRONTEND_PORT=… to pin specific ones.
# Backend logs are prefixed [api], frontend [web]. Ctrl+C kills both.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

if [[ ! -f "$ROOT/scripts/.python-bin" ]]; then
    echo "Run scripts/setup.sh first." >&2
    exit 1
fi
PYTHON_BIN="$(cat "$ROOT/scripts/.python-bin")"

if [[ ! -f "$BACKEND/.env" ]] || [[ ! -f "$FRONTEND/.env.local" ]]; then
    echo "Missing .env files — run scripts/setup.sh and fill in credentials." >&2
    exit 1
fi

# Find first free port at-or-above the start value.
find_free_port() {
    local port="$1" max=$((${1} + 50))
    while [[ $port -lt $max ]]; do
        if ! (exec 3<>/dev/tcp/127.0.0.1/$port) 2>/dev/null; then
            echo "$port"
            return
        fi
        exec 3>&- 2>/dev/null || true
        port=$((port + 1))
    done
    echo "$1"   # give up, return original
}

BACKEND_PORT="${BACKEND_PORT:-$(find_free_port 8000)}"
FRONTEND_PORT="${FRONTEND_PORT:-$(find_free_port 3000)}"

# Let the backend accept whichever frontend port this script picked. This
# overrides backend/.env only for this dev session.
export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-http://localhost:$FRONTEND_PORT,http://127.0.0.1:$FRONTEND_PORT,http://localhost:3000,http://127.0.0.1:3000}"

API_PID=""
WEB_PID=""

cleanup() {
    trap - INT TERM EXIT
    echo
    echo "Stopping…"
    [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
    [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

prefix() {
    local label="$1" color="$2"
    sed -u "s/^/$(printf '\033[1;%sm%s\033[0m ' "$color" "[$label]")/"
}

# ---------------------------------------------------------------------------
# Backend
# ---------------------------------------------------------------------------
(
    cd "$BACKEND"
    exec "$PYTHON_BIN" -m uvicorn app.main:app \
        --host 0.0.0.0 \
        --port "$BACKEND_PORT" \
        --reload \
        --reload-dir app
) 2>&1 | prefix "api" 34 &
API_PID=$!

# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
# Make sure the frontend talks to whichever port the backend actually bound.
export NEXT_PUBLIC_API_URL="http://localhost:$BACKEND_PORT"

(
    cd "$FRONTEND"
    exec node node_modules/next/dist/bin/next dev \
        --webpack \
        --hostname 127.0.0.1 \
        --disable-source-maps \
        --port "$FRONTEND_PORT"
) 2>&1 | prefix "web" 32 &
WEB_PID=$!

echo
echo "Backend  → http://localhost:$BACKEND_PORT  (docs: /docs)"
echo "Frontend → http://localhost:$FRONTEND_PORT"
echo "Ctrl+C to stop both."
echo

wait
