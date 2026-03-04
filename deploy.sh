#!/bin/bash
# Deployment script for richer.nju.top
# Run this on the server

set -e

echo "🚀 Deploying Nannaricher to richer.nju.top..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/nannaricher"
GIT_REPO="your-git-repo-url"  # Update this with your actual repo URL
DOMAIN="richer.nju.top"

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root or with sudo"
    exit 1
fi

# Create app directory if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
    print_status "Creating app directory..."
    mkdir -p $APP_DIR
fi

cd $APP_DIR

# Pull latest code or clone
if [ -d ".git" ]; then
    print_status "Pulling latest code..."
    git pull origin main
else
    print_status "Cloning repository..."
    git clone $GIT_REPO .
fi

# Install dependencies
print_status "Installing dependencies..."
npm ci --production=false

# Build the application
print_status "Building application..."
npm run build

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    npm install -g pm2
fi

# Create logs directory
mkdir -p logs

# Stop existing process if running
print_status "Stopping existing process..."
pm2 stop nannaricher-server 2>/dev/null || true

# Start with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.cjs --env production

# Save PM2 process list
pm2 save

# Ensure PM2 starts on boot
pm2 startup | tail -n 1 | bash || true

# Reload Nginx
print_status "Reloading Nginx..."
if command -v nginx &> /dev/null; then
    nginx -t && systemctl reload nginx
else
    print_warning "Nginx not found, skipping reload"
fi

# Check if application is running
sleep 3
if pm2 list | grep -q "online"; then
    print_status "Application is running!"
    pm2 list
else
    print_error "Application failed to start!"
    pm2 logs nannaricher-server --lines 50
    exit 1
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo "Your application is now running at https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  pm2 logs nannaricher-server  - View logs"
echo "  pm2 restart nannaricher-server - Restart app"
echo "  pm2 stop nannaricher-server  - Stop app"
echo "  pm2 monit                    - Monitor resources"
