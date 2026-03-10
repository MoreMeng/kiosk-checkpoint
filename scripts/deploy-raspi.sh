#!/bin/bash

# Kiosk Checkpoint Deployment Script for Raspberry Pi
# Usage: sudo bash scripts/deploy-raspi.sh

# Exit on any error
set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Kiosk Checkpoint - Raspberry Pi Deployment Script    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/kiosk-checkpoint"
PI_USER="${SUDO_USER:-pi}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_PORT="8080"
API_HOST="192.168.88.8"
API_PORT="6601"

# Trap errors
trap 'handle_error $? $LINENO' ERR

handle_error() {
    local exit_code=$1
    local line_number=$2
    log_error "Script failed at line $line_number with exit code $exit_code"
    echo ""
    echo "Troubleshooting:"
    echo "  Check logs: journalctl -u kiosk -n 20"
    echo "  Verify installation: ls -la $INSTALL_DIR"
    echo "  Try again: sudo bash scripts/deploy-raspi.sh"
    exit "$exit_code"
}

# Functions
log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[→]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        echo "Usage: sudo bash scripts/deploy-raspi.sh"
        exit 1
    fi
}

check_running_on_pi() {
    log_step "Checking if running on Raspberry Pi..."
    if ! grep -q "Raspberry Pi\|BCM\|ARM" /proc/cpuinfo 2>/dev/null; then
        log_warn "Not detected as Raspberry Pi, but may work on other ARM systems"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_info "Raspberry Pi detected"
    fi
}

install_dependencies() {
    log_step "Installing system dependencies..."

    log_info "Updating package lists (may take a minute)..."
    if ! apt-get update; then
        log_error "Failed to update package lists"
        exit 1
    fi

    log_info "Installing packages: nodejs, npm, chromium-browser, git, curl..."
    if ! apt-get install -y \
        nodejs npm \
        chromium-browser \
        git \
        curl; then
        log_error "Failed to install dependencies"
        echo "Try: sudo apt-get update && sudo apt-get upgrade"
        exit 1
    fi

    log_info "Dependencies installed successfully"
}

clone_or_update_project() {
    log_step "Setting up project files..."

    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "Project directory not found: $PROJECT_DIR"
        exit 1
    fi

    if [ ! -f "$PROJECT_DIR/public/index.html" ]; then
        log_error "Project files appear incomplete: missing public/index.html"
        exit 1
    fi

    if [ -d "$INSTALL_DIR" ]; then
        log_info "Installation directory already exists at $INSTALL_DIR"
        read -p "Overwrite? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            log_warn "Skipping copy, using existing installation"
            return
        fi
    fi

    log_info "Copying project to $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"
    cp -r "$PROJECT_DIR"/* "$INSTALL_DIR/"

    if [ ! -f "$INSTALL_DIR/server/index.js" ]; then
        log_error "Copy failed - server/index.js not found"
        exit 1
    fi

    chmod +x "$INSTALL_DIR/server/index.js" 2>/dev/null || true
    chown -R "$PI_USER:$PI_USER" "$INSTALL_DIR"

    log_info "Project files ready at $INSTALL_DIR"
}

install_systemd_services() {
    log_step "Installing systemd services..."

    if [ ! -f "$INSTALL_DIR/systemd/kiosk.service" ]; then
        log_error "Service file not found: $INSTALL_DIR/systemd/kiosk.service"
        exit 1
    fi

    if [ ! -f "$INSTALL_DIR/systemd/chromium-kiosk.service" ]; then
        log_error "Service file not found: $INSTALL_DIR/systemd/chromium-kiosk.service"
        exit 1
    fi

    log_info "Copying kiosk.service..."
    cp "$INSTALL_DIR/systemd/kiosk.service" /etc/systemd/system/

    log_info "Copying chromium-kiosk.service..."
    cp "$INSTALL_DIR/systemd/chromium-kiosk.service" /etc/systemd/system/

    log_info "Updating service configuration..."
    sed -i "s|/opt/kiosk-checkpoint|$INSTALL_DIR|g" /etc/systemd/system/kiosk.service
    sed -i "s|/opt/kiosk-checkpoint|$INSTALL_DIR|g" /etc/systemd/system/chromium-kiosk.service

    log_info "Reloading systemd..."
    systemctl daemon-reload

    log_info "Systemd services installed successfully"
}

configure_api_endpoint() {
    log_step "Configuring API endpoint..."

    echo ""
    echo "Current API Configuration:"
    echo "  Host: $API_HOST"
    echo "  Port: $API_PORT"
    echo "  Full URL: http://$API_HOST:$API_PORT/rxqueue/:HN"
    echo ""

    read -p "Enter API host (default: $API_HOST): " api_host_input
    API_HOST="${api_host_input:-$API_HOST}"

    read -p "Enter API port (default: $API_PORT): " api_port_input
    API_PORT="${api_port_input:-$API_PORT}"

    log_info "Updating API configuration in $INSTALL_DIR/public/js/api-client.js..."

    # Update api-client.js with proper escaping
    if sed -i "s|http://192.168.88.8:6601|http://$API_HOST:$API_PORT|g" \
        "$INSTALL_DIR/public/js/api-client.js"; then
        log_info "API endpoint configured: http://$API_HOST:$API_PORT"
    else
        log_error "Failed to update API configuration"
        exit 1
    fi
}

test_api_connection() {
    log_step "Testing API connection..."

    local test_url="http://$API_HOST:$API_PORT/rxqueue/test"

    if timeout 5 curl -s "$test_url" >/dev/null 2>&1; then
        log_info "API connection successful"
    else
        log_warn "Could not reach API at http://$API_HOST:$API_PORT"
        echo "Note: API server may not be running yet, or network issue"
        echo "You can test later with: curl http://$API_HOST:$API_PORT/rxqueue/HN1234"
}

configure_display() {
    log_step "Checking display configuration..."

    if [ -z "$DISPLAY" ]; then
        log_warn "DISPLAY not set - X server may not be configured"
    else
        log_info "DISPLAY is set to: $DISPLAY"
    fi
}

enable_services() {
    log_step "Enabling systemd services for autostart..."

    if ! systemctl enable kiosk; then
        log_error "Failed to enable kiosk service"
        exit 1
    fi
    log_info "kiosk service enabled"

    if ! systemctl enable chromium-kiosk; then
        log_error "Failed to enable chromium-kiosk service"
        exit 1
    fi
    log_info "chromium-kiosk service enabled"

    log_info "Services will start automatically on next boot"
}

start_services() {
    log_step "Starting services..."

    if ! systemctl start kiosk; then
        log_error "Failed to start kiosk service"
        return 1
    fi
    log_info "kiosk service started"
    sleep 2

    if ! systemctl start chromium-kiosk; then
        log_error "Failed to start chromium-kiosk service"
        return 1
    fi
    log_info "chromium-kiosk service started"

show_status() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║        Deployment Complete! ✓                          ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    echo "Installation Summary:"
    echo "  Location: $INSTALL_DIR"
    echo "  Owner: $PI_USER"
    echo "  Node Server: http://localhost:$NODE_PORT"
    echo "  API Server: http://$API_HOST:$API_PORT"
    echo ""
    echo "Service Status:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    systemctl status kiosk --no-pager 2>/dev/null | head -5 || echo "  [Not started yet]"
    echo ""
    systemctl status chromium-kiosk --no-pager 2>/dev/null | head -5 || echo "  [Not started yet]"
    echo ""
}

show_troubleshooting() {
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║          Troubleshooting & Next Steps                  ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    echo "View Live Logs:"
    echo "  journalctl -u kiosk -f           (Node server logs)"
    echo "  journalctl -u chromium-kiosk -f  (Browser/Chromium logs)"
    echo ""
    echo "Service Management:"
    echo "  sudo systemctl restart kiosk"
    echo "  sudo systemctl restart chromium-kiosk"
    echo "  sudo systemctl stop kiosk"
    echo "  sudo systemctl stop chromium-kiosk"
    echo ""
    echo "Quick Tests:"
    echo "  curl http://localhost:$NODE_PORT            (Check web server)"
    echo "  curl http://$API_HOST:$API_PORT/rxqueue/HN1234   (Check API)"
    echo ""
    echo "Test Web Interface:"
    echo "  If SSH'd in: ssh -X -N -L 8080:localhost:8080 "
    echo "  Then open: http://localhost:8080"
    echo ""
    echo "Autostart Test:"
    echo "  sudo reboot"
    echo "  After reboot, services should start automatically"
    echo ""
}

# ===== MAIN EXECUTION =====

check_root
check_running_on_pi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║        Kiosk Checkpoint - Deployment Plan              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "This script will perform the following steps:"
echo "  1. Install system dependencies (Node.js, Chromium, etc)"
echo "  2. Copy project files to $INSTALL_DIR"
echo "  3. Configure systemd services for autostart"
echo "  4. Configure API endpoint"
echo "  5. Enable and optionally start services"
echo ""
echo "Project Directory: $PROJECT_DIR"
echo "Install Directory: $INSTALL_DIR"
echo "Running as User: $PI_USER"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "Deployment cancelled"
    exit 0
fi

echo ""

# Run installation steps
check_running_on_pi
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
    start_services || log_warn "Some services failed to start"
fi

show_status
show_troubleshooting

log_info "Deployment script completed!"
echo ""
