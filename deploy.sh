#!/bin/bash
set -eo pipefail

# Configuration
if [ -f .env.deploy ]; then
  source .env.deploy
  NAS_USER=$(echo "$NAS_USER" | tr -d '"' | tr -d "'")
  NAS_HOST=$(echo "$NAS_HOST" | tr -d '"' | tr -d "'")
  NAS_PATH=$(echo "$NAS_PATH" | tr -d '"' | tr -d "'")
else
  echo "Error: .env.deploy not found."
  exit 1
fi

# Suppress macOS specific tar metadata warnings locally
export COPYFILE_DISABLE=1

echo "---- Deploying Expense Tracker ----"

# Ensure local folders exist
if [ ! -d "api" ] || [ ! -d "web-react" ]; then
  echo "Error: api or web-react directory not found. Are you running from project root?"
  exit 1
fi

# Ensure directories exist on NAS
ssh "${NAS_USER}@${NAS_HOST}" "mkdir -p \"${NAS_PATH}/api\" \"${NAS_PATH}/web\" \"${NAS_PATH}/data/db\" \"${NAS_PATH}/data/receipts\""

echo "Step 1. Syncing API files..."
(cd api && tar cz --exclude='./node_modules' .) | ssh "${NAS_USER}@${NAS_HOST}" "tar xz -C \"${NAS_PATH}/api\" 2>/dev/null" || exit 1

echo "Step 1.1. Syncing docker-compose and environment..."
tar cz compose.yml .env | ssh "${NAS_USER}@${NAS_HOST}" "tar xz -C \"${NAS_PATH}\" 2>/dev/null" || exit 1

echo "Step 1.2. Syncing initial database if local exists..."
if [ -f "data/db/expenses.sqlite" ]; then
  tar cz data/db/expenses.sqlite | ssh "${NAS_USER}@${NAS_HOST}" "tar xz -C \"${NAS_PATH}\" 2>/dev/null" || true
fi

echo "Step 2. Building & Syncing Web UI (React)..."
(cd web-react && npm run build) || exit 1
(cd web-react/dist && tar cz .) | ssh "${NAS_USER}@${NAS_HOST}" "mkdir -p \"${NAS_PATH}/web\" && tar xz -C \"${NAS_PATH}/web\" 2>/dev/null" || exit 1

echo "Step 2.1. Syncing Nginx Config..."
(cd web && tar cz nginx.conf Dockerfile) | ssh "${NAS_USER}@${NAS_HOST}" "mkdir -p \"${NAS_PATH}/web\" && tar xz -C \"${NAS_PATH}/web\" 2>/dev/null" || exit 1

echo "Step 3. Finalizing stack on NAS (Password required for Docker)..."
ssh -t "${NAS_USER}@${NAS_HOST}" "cd \"${NAS_PATH}\" && sudo chmod -R 777 data && sudo /usr/local/bin/docker compose build --no-cache expense_api && sudo /usr/local/bin/docker compose up -d" || (
  echo "!! Deployment Failed. Attempting to fetch logs..."
  ssh -t "${NAS_USER}@${NAS_HOST}" "sudo /usr/local/bin/docker logs expense_api"
  exit 1
)

echo "Step 4. Verification"
ssh -t "${NAS_USER}@${NAS_HOST}" "sudo /usr/local/bin/docker exec expense_api wget -qO- http://127.0.0.1:3000/health && echo"

echo "---- Deploy Complete ----"
echo "Check: https://tracker.throughthelens.media"