#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi

# Run the Next.js frontend in dev mode.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

PORT="${FRONTEND_PORT:-$(find_free_port 3000)}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000}"

echo "Frontend → http://localhost:$PORT"
echo "API      → $NEXT_PUBLIC_API_URL"

cd "$ROOT/frontend"
exec node node_modules/next/dist/bin/next dev \
    --webpack \
    --hostname 127.0.0.1 \
    --disable-source-maps \
    --port "$PORT"
