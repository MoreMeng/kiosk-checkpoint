# Kiosk Checkpoint (Chromium kiosk)

This scaffold provides a minimal kiosk web app to run on a Raspberry Pi. It listens for barcode/QR scanner input (USB HID keyboard-style or via hidden input), queries the backend API `/rxqueue/:id`, and displays the result.

Quick start (on Raspberry Pi):

1. Clone or copy this repo to `/home/pi/kiosk-checkpoint`.
2. Install dependencies:

```bash
cd /home/pi/kiosk-checkpoint
npm install
```


3. Start mock server for local testing (optional):

If you want to test the front-end locally without the real backend, start the included mock server which listens on port 6601 and provides `/rxqueue/:id`:

```bash
npm install
npm start
```

By default the frontend calls the production backend at `http://192.168.88.8:6601`.
When running the UI from `localhost` the frontend will automatically use the mock server at `http://localhost:6601`.
You can also force mock mode by opening `http://localhost:8080?mock=1` in your browser.

Notes about backend API (important):

- Production: the kiosk should call `http://192.168.88.8:6601/rxqueue/{{queueid}}` directly.
- There is no local proxy in production; ensure the backend allows CORS from the kiosk origin or that kiosk and backend are on the same LAN so direct requests succeed.

**Installation A — HID scanner (Recommended)**
- **When to use**: Your barcode/QR scanner is configured as a USB HID (acts like a keyboard) and sends the scanned code followed by Enter.

- **Overview**: Serve the UI from the Pi, start Chromium in kiosk mode, plug the HID scanner — the page captures keystrokes (no extra bridge needed).

- **Steps (copy these commands and run on the Pi)**

- **1) Place the project on the Pi**: Clone or copy to `/home/pi/kiosk-checkpoint`.

```bash
cd /home/pi
git clone <repo-url> kiosk-checkpoint
cd kiosk-checkpoint
```

- **2) (Optional) Install Node deps for mock testing**:

```bash
cd /home/pi/kiosk-checkpoint
npm install
# Start mock server for local testing (optional)
# npm start
```

- **3) Install Chromium and required packages**:

```bash
sudo apt update
sudo apt install -y chromium-browser python3 python3-pip x11-xserver-utils
```

- **4) Install and enable the local static UI server and kiosk service**

Copy the prepared systemd units to `/etc/systemd/system/` and enable them:

```bash
sudo cp scripts/ui-server.service /etc/systemd/system/ui-server.service
sudo cp scripts/kiosk_chromium.service /etc/systemd/system/kiosk_chromium.service
sudo systemctl daemon-reload
sudo systemctl enable --now ui-server.service
sudo systemctl enable --now kiosk_chromium.service
```

- **5) Set auto-login to GUI (recommended)**

Run Raspberry Pi configuration and enable Desktop Autologin:

```bash
sudo raspi-config
# Choose: System Options -> Boot / Auto Login -> Desktop Autologin
```

- **6) Disable screen blanking**

Create or append autostart settings for the `pi` user:

```bash
mkdir -p /home/pi/.config/lxsession/LXDE-pi
cat >> /home/pi/.config/lxsession/LXDE-pi/autostart <<'EOF'
@xset s off
@xset -dpms
@xset s noblank
EOF
chown -R pi:pi /home/pi/.config
```

- **7) Verify backend connectivity and test**

```bash
# Quick API check (replace AS050 with a test HN)
curl http://192.168.88.8:6601/rxqueue/AS050

# If you run the mock server locally instead:
curl http://localhost:6601/rxqueue/AS050
```

- **8) Test scanner (HID)**

- Plug scanner into USB on the Pi. Open the kiosk UI; it will capture HID input automatically. Scan a barcode/QR — the UI should display the queue info within seconds.

- **Troubleshooting**
- **No UI shown**: Check `sudo systemctl status ui-server.service` and `sudo systemctl status kiosk_chromium.service`.
- **Scanner not triggering**: Confirm scanner is in HID/keyboard mode. On a text field, scanning should paste text + Enter. Use `evtest` or `sudo libinput list-devices` to inspect devices.
- **CORS errors in console**: Backend must allow CORS from the kiosk origin; ask backend team to add `Access-Control-Allow-Origin` header for the kiosk origin.

**Files referenced**
- UI service: [scripts/ui-server.service](scripts/ui-server.service)
- Kiosk service: [scripts/kiosk_chromium.service](scripts/kiosk_chromium.service)


4. Launch Chromium in kiosk mode (auto-start via systemd or autostart):

```bash
chromium-browser --noerrdialogs --kiosk --incognito --disable-translate --disable-infobars http://localhost:8080
```

Systemd example: copy `scripts/kiosk.service` to `/etc/systemd/system/kiosk.service`, edit `WorkingDirectory` and the service environment as needed, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kiosk.service
```

Notes and next steps:
- Tweak `/public/app.js` to adjust UI timings or add offline queueing.
- Consider running the proxy server behind a process manager or container.
- For security, use HTTPS between kiosk and backend where possible.

Serial scanner (serial/USB) on Raspberry Pi

If your barcode/QR scanner exposes a serial device (e.g. `/dev/ttyUSB0`) you can use the included Python script to read codes and call the backend directly.

Install dependencies on the Pi:

```bash
sudo apt update && sudo apt install -y python3-pip
pip3 install pyserial requests
```

Run the reader (default device `/dev/ttyUSB0`):

```bash
python3 scripts/serial_reader.py --device /dev/ttyUSB0
```

Options:
- `--print-only`: only print scanned codes, don't call backend
- `--backend`: override backend base URL (default http://192.168.88.8:6601)

This script is useful for testing and can be run as a systemd service on the Pi to forward scans to the hospital API. For production, prefer to ensure the kiosk browser receives the scanned value directly (HID keyboard mode) or implement a small local bridge with WebSocket to send scans to the web UI.

Serial -> WebSocket bridge

Alternatively you can run the WebSocket bridge which broadcasts serial scans to connected browsers (useful when Chromium kiosk needs to receive scans from a serial-only scanner):

```bash
pip3 install websockets pyserial
python3 scripts/serial_ws_bridge.py --device /dev/ttyUSB0 --baud 9600 --port 8765
```

Open the kiosk UI on the Pi (localhost) and it will automatically connect to `ws://localhost:8765` and trigger lookups when scans arrive.

Systemd example: copy `scripts/serial_ws.service` to `/etc/systemd/system/serial_ws.service`, edit `WorkingDirectory` and `ExecStart` if needed, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now serial_ws.service
```
