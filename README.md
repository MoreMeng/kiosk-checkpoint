# Kiosk Checkpoint - Queue Status Display System

ระบบแสดงสถานะคิวอัตโนมัติบน Raspberry Pi โดยใช้ barcode/QR scanner

## 📋 Features

✅ **UI ง่ายใช้** - สำหรับผู้ป่วยอ่าน และมีตัวอักษรใหญ่
✅ **Barcode Scanner Integration** - USB HID keyboard wedge
✅ **API Integration** - เชื่อมต่อ `http://192.168.88.8:6601/rxqueue/:HN`
✅ **Offline Support** - local queue + retry อัตโนมัติ
✅ **Autostart** - systemd service บน Raspberry Pi
✅ **Responsive Design** - HDMI monitor, touch-friendly UI
✅ **Zero Touch** - ไม่ต้อง mouse/keyboard ในการใช้งานปกติ
✅ **Scan Logging** - บันทึกข้อมูลการสแกนลง CSV file สำหรับการตรวจสอบ

---

## 🏗️ Architecture

```
kiosk-checkpoint/
├── public/                # Frontend (HTML/CSS/JS)
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── app.js              # Main app logic
│       ├── api-client.js       # API + offline queue
│       └── scanner.js          # USB HID handler
├── server/
│   ├── index.js            # Simple Node HTTP server
│   └── logger.js           # CSV logging module
├── logs/                   # Scan logs directory
│   └── scan_logs.csv       # CSV file with scan records
├── systemd/
│   ├── kiosk.service       # Node server service
│   └── chromium-kiosk.service  # Chromium kiosk mode
├── package.json
├── README.md
├── LOGGING_FEATURE.md      # Logging feature documentation
└── COPILOT_INSTRUCTION.md
```

### Data Flow

```
Barcode Scanner (USB HID)
         ↓
   scanner.js (read keypress)
         ↓
   app.js (validate + show loading)
         ↓
   api-client.js (call /rxqueue/:HN)
         ↓
   [Success] → Display queue card + 15s auto-return
   [Fail]    → Enqueue offline + retry on reconnect
```

---

## 🔧 Hardware Requirements

- **Raspberry Pi 4** (หรือสูงกว่า)
  - RAM: 2GB+ (4GB ดีกว่า)
  - Storage: 32GB microSD+
  - Power: 5V/3A USB-C

- **Display**
  - HDMI monitor (27-32 inch recommended)
  - Headless mode: ไม่ต้อง keyboard/mouse

- **Barcode/QR Scanner**
  - Preferred: USB HID keyboard wedge (พวก "บาร์โค้ดเลวร์")
  - Alternative: Serial scanner (USBtoSerial)
  - ส่งข้อมูล: text + Enter key

- **Network**
  - Ethernet หรือ WiFi
  - ต่อหลัง backend: `192.168.88.8:6601`

---

## 📦 Installation

### 1. Raspberry Pi OS Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y \
  nodejs npm \
  chromium-browser \
  xserver-xorg xinit \
  lightdm \
  git

# Create kiosk user (optional but recommended)
sudo useradd -m -s /bin/bash -G audio,video kiosk
```

### 2. Clone & Install Project

```bash
# Clone project
git clone https://github.com/yourusername/kiosk-checkpoint.git /opt/kiosk-checkpoint
cd /opt/kiosk-checkpoint

# Install Node dependencies (ในกรณีนี้ไม่มี npm packages)
npm install

# Create logs directory (required for systemd service)
mkdir -p /opt/kiosk-checkpoint/logs

# Set permissions
sudo chown -R pi:pi /opt/kiosk-checkpoint
chmod +x server/index.js
```

### 3. Install Systemd Services

```bash
# Copy service files
sudo cp systemd/kiosk.service /etc/systemd/system/
sudo cp systemd/chromium-kiosk.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable kiosk
sudo systemctl enable chromium-kiosk

# Start services
sudo systemctl start kiosk
sudo systemctl start chromium-kiosk
```

### 4. Configure Network (ถ้าต้อง)

ในไฟล์ `public/js/api-client.js` ให้แก้ไข:

```javascript
this.apiBaseUrl = 'http://192.168.88.8:6601';  // ✏️ เปลี่ยนเป็น IP backend ของคุณ
```

---

## 🚀 Running Locally (for testing)

### บน Windows/Mac/Linux

```bash
# Install Node.js ก่อน (https://nodejs.org)

# Go to project directory
cd kiosk-checkpoint

# Start server
npm start

# Open browser
# -> http://localhost:8080
```

### Test Barcode Scanner

เมื่อเว็บเปิดแล้ว สามารถใช้ browser console:

```javascript
// Simulate barcode scan (HN1234)
app.testScan('HN1234');

// หรือพิมพ์ HN1234 แล้วกด Enter (ถ้า USB scanner ต่อ)

// View offline queue
app.showOfflineQueue();

// Clear offline queue
app.clearOfflineQueue();
```

---

## 📱 API Integration

### GET /rxqueue/:patientIdEndpoint

```
GET http://192.168.88.8:6601/rxqueue/HN1234 HTTP/1.1
Accept: application/json
```

### Response (Expected)

```json
[
  {
    "source": "คิวห้องตรวจ",
    "ref_id": 3812185,
    "qid": "AS050",
    "qno": "50",
    "qstn": "รอเรียกซักประวัติ",
    "queue_priority": 1,
    "qdate": "2026-03-10",
    "cdate": null,
    "location": "172 จุดซักประวัติศัลยกรรม (ชั้น 3)",
    "department_code": "330",
    "ost_name": "ตรวจแล้ว"
  }
]
```

### Field Mapping (Display)

| Response Field | Display Label | Notes |
|---|---|---|
| `qno` / `qid` | หมายเลขคิว | ใหญ่ เด่น (4rem) |
| `ost_name` | สถานะ | เช่น "ตรวจแล้ว" |
| `qstn` | สิ่งที่ต้องทำ | เช่น "รอเรียก" |
| `location` | อยู่ที่ | เช่น ชื่อห้อง ชั้น |
| `department_code` | แผนก | โค้ดแผนก |
| `qdate` | วันที่ | formatted as Thai date |

### CORS Requirement

⚠️ **Important**: Backend API ต้องรองรับ CORS หรือ kiosk ต้องอยู่ LAN เดียวกัน

ถ้า API ไม่รองรับ CORS ให้เพิ่ม header:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Accept, Content-Type
```

---

---

## 📊 Scan Logging

ระบบจะบันทึกข้อมูลการสแกน QR/Barcode ลง CSV file โดยอัตโนมัติ ซึ่งสามารถนำไปใช้ตรวจสอบหรือวิเคราะห์ได้

### CSV Format

```
วันที่,เวลา,ข้อมูลที่สแกน
25/03/2569,14:30:45,"1B205"
25/03/2569,14:32:10,"CS010"
```

### Logging APIs

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/logs` | POST | บันทึกข้อมูลการสแกน (อัตโนมัติ) |
| `/api/logs` | GET | ดึงข้อมูล logs ทั้งหมด |
| `/api/logs/download` | GET | ดาวน์โหลด CSV file |
| `/api/logs/clear` | DELETE | ล้างข้อมูล logs (สำหรับการทดสอบ) |

### File Location

```
logs/scan_logs.csv
```

ดูรายละเอียดเพิ่มเติมใน: [LOGGING_FEATURE.md](LOGGING_FEATURE.md)

---

## 📡 Offline & Retry Strategy

1. **Failed API Call**
   - บันทึก HN ไปที่ `localStorage` (key: `kioskOfflineQueue`)
   - แสดง error message ให้ user
   - Auto return หลัง 10 วินาที

2. **Background Retry**
   - ถ้า network กลับมา → trigger retry queue
   - Retry up to 3 times พร้อม exponential backoff
   - ลบจาก queue เมื่อสำเร็จ

3. **Cache**
   - เก็บผลลัพธ์สำเร็จไว้ 30 วินาที
   - ใช้ cache ถ้า network ตัด

---

## � Debug Mode (บน Raspberry Pi)

ถ้าต้องการดู DevTools console บนจอเครื่อง Chromium เพื่อ debug:

### เปิด DevTools แบบ Auto-Open

DevTools จะเปิดอัตโนมัติด้านข้างของหน้า kiosk:

```bash
# ตรวจสอบว่า chromium-kiosk.service มี flag:
#   --auto-open-devtools-for-tabs

sudo systemctl status chromium-kiosk
sudo journalctl -u chromium-kiosk -f
```

### ปิด Debug Mode เมื่อเสร็จ

เมื่อไม่ต้องการ DevTools แล้ว ให้ลบ `--auto-open-devtools-for-tabs` ออกจาก:

```bash
sudo nano /etc/systemd/system/chromium-kiosk.service
# ลบบรรทัด: --auto-open-devtools-for-tabs
sudo systemctl daemon-reload
sudo systemctl restart chromium-kiosk
```

---

## �🛑 Troubleshooting

### 1. Chromium ไม่ start

```bash
# Check status
sudo systemctl status chromium-kiosk

# View logs
journalctl -u chromium-kiosk -n 50 -f

# Manual start (debug)
export DISPLAY=:0
/usr/bin/chromium-browser --kiosk http://localhost:8080
```

### 2. Node server ไม่ตอบ / systemd service ล้มเหลว

**Error: "Failed to set up mount namespacing" หรือ "Failed at step NAMESPACE"**

```bash
# Check service status
sudo systemctl status kiosk

# View detailed logs
sudo journalctl -u kiosk -n 20
```

**แก้ไข:**

```bash
# 1. สร้าง logs directory ที่ service ต้องการ
mkdir -p /opt/kiosk-checkpoint/logs

# 2. ตรวจสอบว่า kiosk.service ไม่มี ProtectSystem=strict หรือ PrivateTmp=true
# (security restrictions ที่ทำให้ mount fail บน Raspberry Pi)
# ไฟล์ควรมีแค่ NoNewPrivileges=true

# 3. Reload systemd และ restart
sudo systemctl daemon-reload
sudo systemctl restart kiosk

# 4. Test manually ถ้ายังไม่ได้
sudo systemctl stop kiosk
cd /opt/kiosk-checkpoint
node server/index.js
```

**ถ้ายังไม่ได้:**

```bash
# Test network
curl http://localhost:8080

# Check if port 8080 is in use
sudo lsof -i :8080

# Kill process if needed
sudo fuser -k 8080/tcp
```

### 3. API ยังไม่ตอบ / CORS error

```bash
# Check from Raspberry Pi console
curl -i http://192.168.88.8:6601/rxqueue/HN1234

# If CORS error, need to:
# 1. Configure backend CORS headers
# 2. Or use proxy (see next section)
```

### 4. Barcode Scanner ไม่ทำงาน

```bash
# Check USB devices
lsusb

# Test keyboard input (open chrome console and type):
# Should have console.log ในไฟล์ scanner.js
```

---

## 🔄 Backend Proxy (Optional)

ถ้า API ไม่รองรับ CORS ให้สร้าง proxy ใน `server/index.js`:

```javascript
// เพิ่มใน server/index.js
const http = require('http');
const apiUrl = 'http://192.168.88.8:6601';

server.on('request', (req, res) => {
    if (req.url.startsWith('/api/rxqueue/')) {
        const patientId = req.url.split('/').pop();
        const target = `${apiUrl}/rxqueue/${patientId}`;

        http.get(target, (apiRes) => {
            res.writeHead(apiRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            apiRes.pipe(res);
        });
        return;
    }
    // ... rest of server code
});
```

แล้วแก้ไข `api-client.js`:

```javascript
const url = `http://localhost:8080/api/rxqueue/${patientId}`;
```

---

## 📊 Logging & Monitoring

### View Live Logs

```bash
# Kiosk (Node) server
journalctl -u kiosk -f

# Chromium display
journalctl -u chromium-kiosk -f

# Both
journalctl -u kiosk -u chromium-kiosk -f
```

### Browser Console

1. เปิด Chrome DevTools: `Ctrl+Shift+I`
2. Console tab → ดู log messages
3. ตัวอย่าง:
   ```
   [Scanner] Barcode detected: HN1234
   [API] Fetching: http://192.168.88.8:6601/rxqueue/HN1234
   [App] Displaying queue data: {...}
   ```

---

## 🔐 Security Notes

- ✓ Frontend เรียก API ตรงไป (no proxy by default)
- ✓ HTTPS ควร enable ถ้าเป็นไปได้
- ✓ `no-store` cache control สำหรับ HTML
- ✓ `Content-Security-Policy` headers (optional)
- ⚠️ Offline queue เก็บใน localStorage (plain text) - เหมาะเพื่อ retry เท่านั้น

---

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Manual Test Cases

| Case | Steps | Expected |
|---|---|---|
| **Valid Scan** | Scan HN1234 | Show queue card, auto-return 15s |
| **Invalid Scan** | Scan "   " (empty) | Show error ~10s, return to idle |
| **Network Error** | Unplug ethernet, scan | Enqueue offline, show message |
| **Offline Recovery** | Connect back | Auto-retry from offline queue |
| **Cache Hit** | Scan same HN twice (< 30s) | Show cached result |

---

## 📝 Deployment Checklist

- [ ] Node.js และ Chromium installed
- [ ] systemd services ติดตั้ง
- [ ] API endpoint ทดสอบ OK (`192.168.88.8:6601`)
- [ ] CORS รองรับ หรือ proxy ตั้งค่า
- [ ] Barcode scanner ทดสอบ (manual keypress)
- [ ] Network กำหนด (Ethernet/WiFi)
- [ ] HDMI monitor ต่อแล้ว
- [ ] Autostart ทดสอบ (reboot)

---

## 🔄 Updates & Maintenance

### Pull Latest Changes

```bash
cd /opt/kiosk-checkpoint
git pull origin main
sudo systemctl restart kiosk
```

### Clear Cache & Offline Queue

```javascript
// ในไฟล์ public/js/app.js หรือ console
localStorage.clear();
console.log('Cache cleared');
```

### Logs Rotation

```bash
# systemd ควบคุม logs โดยอัตโนมัติ
# ดูขนาด
journalctl --disk-usage
```

---

## 📞 Support

- 📄 Config: ดู `public/js/api-client.js`
- 🐛 Debug: เปิด Console (Ctrl+Shift+I)
- 📋 Logs: `journalctl -u kiosk -f`
- 🔗 Backend API: `GET /rxqueue/:HN`

---

## 📄 License

MIT License - see LICENSE file

---

**Last Updated**: March 25, 2026
**Version**: 1.0.0 (hotfix/0.0.9)

