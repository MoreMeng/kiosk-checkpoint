#!/bin/bash

# Kiosk Checkpoint Deployment Script for Raspberry Pi
# Usage: bash scripts/deploy-raspi.sh

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Kiosk Checkpoint - Raspberry Pi Deployment Script    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/kiosk-checkpoint"
PI_USER="pi"
NODE_PORT="8080"
API_HOST="192.168.88.8"
API_PORT="6601"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_running_on_pi() {
    if ! grep -q "Raspberry Pi\|BCM\|ARM" /proc/cpuinfo 2>/dev/null; then
        log_warn "This script is designed for Raspberry Pi but may work on other ARM systems"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

install_dependencies() {
    log_info "Installing system dependencies..."

    apt-get update -qq >/dev/null 2>&1 || exit 1

    # Install packages
    apt-get install -y -qq \
        nodejs npm \
        chromium-browser \
        git \
        curl \
        >/dev/null 2>&1 || exit 1

    log_info "Dependencies installed"
}

clone_or_update_project() {
    if [ -d "$INSTALL_DIR" ]; then
        log_info "Updating existing installation at $INSTALL_DIR..."
        cd "$INSTALL_DIR"
        git pull origin main 2>/dev/null || log_warn "Could not update from git"
    else
        log_info "Cloning project to $INSTALL_DIR..."
        if [ -d ".git" ]; then
            # Already in git repo, copy to install dir
            cp -r . "$INSTALL_DIR"
        else
            log_error "Could not find project files"
            exit 1
        fi
    fi

    chmod +x "$INSTALL_DIR/server/index.js"
    chown -R "$PI_USER:$PI_USER" "$INSTALL_DIR"

    log_info "Project files ready at $INSTALL_DIR"
}

install_systemd_services() {
    log_info "Installing systemd services..."

    # Copy service files
    cp "$INSTALL_DIR/systemd/kiosk.service" /etc/systemd/system/
    cp "$INSTALL_DIR/systemd/chromium-kiosk.service" /etc/systemd/system/

    # Update paths in service files (if needed)
    sed -i "s|/opt/kiosk-checkpoint|$INSTALL_DIR|g" /etc/systemd/system/kiosk.service
    sed -i "s|/opt/kiosk-checkpoint|$INSTALL_DIR|g" /etc/systemd/system/chromium-kiosk.service

    # Reload systemd
    systemctl daemon-reload

    log_info "Systemd services installed"
}

configure_api_endpoint() {
    log_info "Configuring API endpoint..."

    echo ""
    echo "API Configuration:"
    echo "  Current endpoint: http://$API_HOST:$API_PORT/rxqueue/:HN"
    echo ""
    read -p "Enter API host (default: $API_HOST): " api_host_input
    API_HOST="${api_host_input:-$API_HOST}"

    read -p "Enter API port (default: $API_PORT): " api_port_input
    API_PORT="${api_port_input:-$API_PORT}"

    # Update api-client.js
    sed -i "s|http://192.168.88.8:6601|http://$API_HOST:$API_PORT|g" \
        "$INSTALL_DIR/public/js/api-client.js"

    log_info "API endpoint configured: http://$API_HOST:$API_PORT"
}

test_api_connection() {
    log_info "Testing API connection..."

    if timeout 5 curl -s "http://$API_HOST:$API_PORT/rxqueue/test" >/dev/null 2>&1; then
        log_info "API connection test passed"
    else
        log_warn "Could not reach API at http://$API_HOST:$API_PORT"
        log_warn "Please ensure the API server is running and accessible"
    fi
}

configure_display() {
    log_info "Configuring display..."

    # Check if running under X
    if [ -z "$DISPLAY" ]; then
        log_warn "DISPLAY not set - X server may not be configured"
    else
        log_info "DISPLAY: $DISPLAY"
    fi
}

enable_services() {
    log_info "Enabling systemd services for autostart..."

    systemctl enable kiosk
    systemctl enable chromium-kiosk

    log_info "Services will start on next reboot"
}

start_services() {
    log_info "Starting services..."

    systemctl start kiosk
    sleep 2

    systemctl start chromium-kiosk
    sleep 2

    log_info "Services started"
}

show_status() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║            Deployment Complete! ✓                      ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    echo "Service Status:"
    systemctl status kiosk --no-pager | head -10
    echo ""
    systemctl status chromium-kiosk --no-pager | head -10
    echo ""
    echo "Next Steps:"
    echo "1. Verify services are running:"
    echo "   → journalctl -u kiosk -f"
    echo "   → journalctl -u chromium-kiosk -f"
    echo ""
    echo "2. Test in browser (if SSH):"
    echo "   → curl http://localhost:8080"
    echo ""
    echo "3. Reboot to test autostart:"
    echo "   → sudo reboot"
    echo ""
    echo "4. Connect barcode scanner and test scanning"
    echo ""
}

show_troubleshooting() {
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║              Troubleshooting Commands                   ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    echo "View logs:"
    echo "  journalctl -u kiosk -n 50 -f"
    echo "  journalctl -u chromium-kiosk -n 50 -f"
    echo ""
    echo "Restart services:"
    echo "  sudo systemctl restart kiosk"
    echo "  sudo systemctl restart chromium-kiosk"
    echo ""
    echo "Stop services:"
    echo "  sudo systemctl stop kiosk"
    echo "  sudo systemctl stop chromium-kiosk"
    echo ""
    echo "Test API (from Raspberry Pi):"
    echo "  curl http://$API_HOST:$API_PORT/rxqueue/HN1234"
    echo ""
}

# ===== MAIN EXECUTION =====

check_running_on_pi
check_root

echo ""
echo "This script will:"
echo "  1. Install Node.js and Chromium"
echo "  2. Copy project files to $INSTALL_DIR"
echo "  3. Configure systemd services"
echo "  4. Set API endpoint"
echo "  5. Enable autostart"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "Deployment cancelled"
    exit 1
fi

echo ""

# Run installation steps
install_dependencies
clone_or_update_project
install_systemd_services
configure_api_endpoint
test_api_connection
configure_display
enable_services

# Optional: start immediately
echo ""
read -p "Start services now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    start_services
    show_status
fi

show_troubleshooting

log_info "Deployment script completed!"
