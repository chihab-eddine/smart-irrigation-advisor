#!/bin/bash
set -e

echo "==================================================="
echo "  Smart Irrigation - GCP VM Deployment Script"
echo "==================================================="

# 1. Update system and install basic dependencies
echo "[1/6] Updating system and installing dependencies..."
sudo apt-get update -y
sudo apt-get install -y curl debian-keyring debian-archive-keyring apt-transport-https python3 python3-venv python3-pip

# 2. Install Node.js (v20)
echo "[2/6] Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 3. Install PM2
echo "[3/6] Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# 4. Install Caddy
echo "[4/6] Installing Caddy Web Server..."
if ! command -v caddy &> /dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt-get update -y
    sudo apt-get install caddy -y
fi

# 5. Build and setup Backend
echo "[5/6] Setting up FastAPI Backend..."
cd backend
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
.venv/bin/pip install -r requirements.txt
cd ..

# 6. Build and setup Frontend
echo "[6/6] Setting up Next.js Frontend..."
cd frontend
npm install
npm run build
cd ..

# 7. Start services with PM2
echo "[7/7] Starting services..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup | grep "sudo env" | bash || true

# 8. Start Caddy
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl restart caddy

echo "==================================================="
echo "Deployment Complete!"
echo "Your app should now be live."
echo "Make sure you copied your .env files to frontend/.env and backend/.env"
echo "==================================================="
