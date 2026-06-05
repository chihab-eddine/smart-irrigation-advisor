#!/usr/bin/env bash
# Re-exec under bash if invoked via `sh script.sh` (Ubuntu's /bin/sh is dash).
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi

# First-time setup for Smart Irrigation Advisor.
#
# Prepares:
#   - backend/.venv (or anaconda env)  + installs requirements.txt
#   - frontend/node_modules            via npm install
#   - backend/.env and frontend/.env.local from .env.example (if missing)
#
# Re-running is safe — it skips work already done.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# Pretty output
log()   { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m!\033[0m %s\n' "$*"; }
fail()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Python environment
# ---------------------------------------------------------------------------
log "Detecting Python environment for backend"

PYTHON_BIN=""
USE_VENV=0

# Honour an explicit override
if [[ -n "${PYTHON:-}" ]]; then
    PYTHON_BIN="$PYTHON"
    log "Using \$PYTHON override: $PYTHON_BIN"
elif [[ -x "$BACKEND/.venv/bin/python" ]]; then
    # Re-use only if pip works inside it — otherwise the venv is broken.
    if "$BACKEND/.venv/bin/python" -m pip --version >/dev/null 2>&1; then
        PYTHON_BIN="$BACKEND/.venv/bin/python"
        USE_VENV=1
        log "Reusing existing venv at backend/.venv"
    else
        warn "backend/.venv is broken (no pip) — rebuilding"
        rm -rf "$BACKEND/.venv"
    fi
fi

if [[ -z "$PYTHON_BIN" ]]; then
    # Try to create a fresh venv first; fall back to anaconda if that fails.
    if command -v python3 >/dev/null 2>&1 && python3 -m venv --help >/dev/null 2>&1; then
        log "Creating backend/.venv (python3 -m venv)"
        if python3 -m venv "$BACKEND/.venv" 2>/dev/null \
            && "$BACKEND/.venv/bin/python" -m pip --version >/dev/null 2>&1; then
            PYTHON_BIN="$BACKEND/.venv/bin/python"
            USE_VENV=1
            ok "Created backend/.venv"
        else
            warn "venv creation succeeded but pip is missing (install python3-venv)"
            rm -rf "$BACKEND/.venv"
        fi
    fi

    if [[ -z "$PYTHON_BIN" ]]; then
        # venv unavailable — fall back to anaconda or any python3 with pip.
        for candidate in "$HOME/anaconda3/bin/python3" "$HOME/miniconda3/bin/python3" python3; do
            if [[ -x "$candidate" ]] || command -v "$candidate" >/dev/null 2>&1; then
                if "$candidate" -m pip --version >/dev/null 2>&1; then
                    PYTHON_BIN="$candidate"
                    warn "Using system/anaconda Python: $candidate (no venv)"
                    warn "  → Install 'python3-venv' (apt install python3.12-venv) for an isolated env"
                    break
                fi
            fi
        done
    fi
fi

[[ -n "$PYTHON_BIN" ]] || fail "No usable Python found. Install python3-venv or anaconda."

# ---------------------------------------------------------------------------
# 2. Install backend dependencies
# ---------------------------------------------------------------------------
log "Installing backend requirements"
"$PYTHON_BIN" -m pip install --upgrade pip --quiet
"$PYTHON_BIN" -m pip install -r "$BACKEND/requirements.txt" --quiet
ok "Backend dependencies installed"

# Record which Python the dev scripts should use.
echo "$PYTHON_BIN" > "$ROOT/scripts/.python-bin"

# ---------------------------------------------------------------------------
# 3. Backend .env
# ---------------------------------------------------------------------------
if [[ ! -f "$BACKEND/.env" ]]; then
    cp "$BACKEND/.env.example" "$BACKEND/.env"
    warn "Created backend/.env — fill in real Supabase credentials before running"
else
    ok "backend/.env already exists"
fi

# ---------------------------------------------------------------------------
# 4. Frontend dependencies
# ---------------------------------------------------------------------------
command -v node >/dev/null || fail "Node.js not found. Install Node 20+ first."
command -v npm  >/dev/null || fail "npm not found."

log "Installing frontend dependencies"
( cd "$FRONTEND" && npm install --silent )
ok "Frontend dependencies installed"

# ---------------------------------------------------------------------------
# 5. Frontend .env.local
# ---------------------------------------------------------------------------
if [[ ! -f "$FRONTEND/.env.local" ]]; then
    cp "$FRONTEND/.env.example" "$FRONTEND/.env.local"
    warn "Created frontend/.env.local — fill in real Supabase credentials before running"
else
    ok "frontend/.env.local already exists"
fi

# ---------------------------------------------------------------------------
# 6. Done
# ---------------------------------------------------------------------------
cat <<EOF

$(ok "Setup complete")

Next steps:
  1. Edit backend/.env       → SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET
  2. Edit frontend/.env.local → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
  3. Run:    scripts/dev.sh
     or:     scripts/backend-dev.sh  (backend only)
             scripts/frontend-dev.sh (frontend only)

  See DEPLOYMENT.md for the full Supabase + model-training + deploy walkthrough.
EOF
