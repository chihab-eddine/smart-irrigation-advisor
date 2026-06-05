#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi

# Run the FastAPI backend with auto-reload.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[[ -f "$ROOT/scripts/.python-bin" ]] || { echo "Run scripts/setup.sh first." >&2; exit 1; }
PYTHON_BIN="$(cat "$ROOT/scripts/.python-bin")"

find_free_port() {
    local port="$1" max=$((${1} + 50))
    while [[ $port -lt $max ]]; do
        if ! (exec 3<>/dev/tcp/127.0.0.1/$port) 2>/dev/null; then
            echo "$port"; return
        fi
        exec 3>&- 2>/dev/null || true
        port=$((port + 1))
    done
    echo "$1"
}

PORT="${BACKEND_PORT:-$(find_free_port 8000)}"
echo "Backend → http://localhost:$PORT"

cd "$ROOT/backend"
exec "$PYTHON_BIN" -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --reload \
    --reload-dir app
