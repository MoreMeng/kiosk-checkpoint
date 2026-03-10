# 🚀 Quick Start Guide

**สำหรับการทดสอบอย่างรวดเร็วบนเครื่องส่วนตัว (Windows/Mac/Linux)**

---

## 📋 ข้อกำหนดเบื้องต้น

- [Node.js 14+](https://nodejs.org)
- Browser (Chrome, Firefox, Safari, Edge)
- Internet connection (หรือ local network หากมี mock API)

---

## ⚡ 3 ขั้นตอน:

### 1️⃣ เปิด Terminal ไปยังโปรเจกต์

```bash
cd kiosk-checkpoint
```

### 2️⃣ Start Server

```bash
npm start
```

ผลลัพธ์ที่ควรเห็น:
```
╔════════════════════════════════════════╗
║   Kiosk Checkpoint Server Started      ║
╠════════════════════════════════════════╣
║ Server: http://localhost:8080      ║
║ Health: http://localhost:8080/health   ║
╚════════════════════════════════════════╝
```

### 3️⃣ เปิด Browser

นำทางไปที่: **http://localhost:8080**

---

## 🧪 ทดสอบการทำงาน

### วิธีที่ 1: ใช้ Console (ง่ายที่สุด)

1. เปิด DevTools: `Ctrl+Shift+I` (Windows) หรือ `Cmd+Option+I` (Mac)
2. ไปที่ **Console** tab
3. วางโค้ด:
   ```javascript
   app.testScan('HN1234');
   ```
4. กด Enter

**ผลลัพธ์ที่ควรเห็น:**
- Loading spinner ลงจุด "กำลังดึงข้อมูล..."
- (ถ้า API ไม่ตอบ) Error message หลังจากนั้น ⚠️

### วิธีที่ 2: Mock API Server (ขั้นสูง)

ถ้าคุณต้องการ test ที่มี mock API ที่ตอบข้อมูลจริง:

```bash
# ยังไม่มี mock server ในไฟล์ นี้ แต่สามารถสร้างได้ดังนี้:
# 1. สร้าง server/mock-api.js
# 2. Proxy requests ไปยัง mock endpoint
# ดูรายละเอียดใน README.md
```

### วิธีที่ 3: Simulate Scanner Input

ใช้ keyboard เพื่อ simulate barcode scanner:

1. คลิกบน browser window (ให้ focus)
2. พิมพ์: `HN1234` แล้วกด **Enter**
3. ระบบจะประมวลผลเหมือน barcode reader

---

## 📊 ตรวจสอบสถานะ

### Server Health Check

```bash
curl http://localhost:8080/health
```

ผลลัพธ์:
```json
{"status":"ok","timestamp":"2026-03-10T10:00:00Z"}
```

### View Console Logs

DevTools Console แสดง log ในรูปแบบ:
```
[Scanner] Barcode detected: HN1234
[API] Fetching: http://192.168.88.8:6601/rxqueue/HN1234
[App] Displaying queue data: {...}
[Offline] Enqueued: HN1234
```

---

## 🔧 Configuration

### เปลี่ยน API Endpoint

ใน `public/js/api-client.js` แก้ไข:

```javascript
this.apiBaseUrl = 'http://YOUR_API_HOST:PORT';
```

ตัวอย่าง:
```javascript
this.apiBaseUrl = 'http://localhost:3000';  // Local mock API
// หรือ
this.apiBaseUrl = 'http://192.168.1.100:6601';  // Production
```

### Enable CORS สำหรับ Local Testing

ถ้า API ของคุณไม่รองรับ CORS และผลลัพธ์ error ในประเทศของคุณ:

```javascript
// ใน server/index.js เพิ่มบรรทัดนี้:
res.setHeader('Access-Control-Allow-Origin', '*');
```

---

## 🐛 Troubleshooting

### ❌ "Cannot GET /"

**ปัญหา:** Server ไม่จำหน่าย static files
**วิธีแก้:** ตรวจสอบว่า `public/index.html` มีอยู่

```bash
ls -la public/index.html
```

### ❌ "ERR_CONNECTION_REFUSED"

**ปัญหา:** Server ยังไม่ start
**วิธีแก้:** ใช้ `npm start` และรอให้ port 8080 เปิด

### ❌ API Returns 404 or CORS Error

**ปัญหา:** API endpoint ไม่ถูกต้อง
**วิธีแก้:**
1. ตรวจสอบ URL ใน `api-client.js`
2. ทดสอบ curl จาก terminal:
   ```bash
   curl http://192.168.88.8:6601/rxqueue/HN1234
   ```

### ❌ Barcode Input ไม่ทำงาน

**ปัญหา:** USB Scanner ไม่่มี หรือ input ไม่ focus
**วิธีแก้:**
- ตรวจสอบ `app.testScan('HN1234')` ใน console แทน
- ใช้ keyboard input ต่อ browser window

---

## 📝 Debug Commands

ใช้คำสั่งเหล่านี้ใน Console DevTools:

```javascript
// View current state
app.showOfflineQueue();

// Simulate scan
app.testScan('HN1234');

// Clear cache
app.clearOfflineQueue();
localStorage.clear();

// Check network status
navigator.onLine;

// View API client config
app.apiClient.apiBaseUrl;
```

---

## ✅ Success Checklist

- [ ] Server start ด้วย `npm start`
- [ ] Browser open http://localhost:8080 ได้
- [ ] Idle screen แสดง "กรุณาสแกนใบการตรวจ"
- [ ] Simulate scan `app.testScan('HN1234')` ทำงาน
- [ ] Error/loading/result screen แสดงถูกต้อง
- [ ] Auto-return ทำงาน ภายใน 10-15 นาที

---

## 🚀 Next: Deploy to Raspberry Pi

เมื่อพร้อม deploy ไปยัง Raspberry Pi:

```bash
bash scripts/deploy-raspi.sh
```

ดู [README.md](README.md) สำหรับรายละเอียด

---

**Good Luck! 🎉**

ถ้ามี error ให้เปิด Issue หรือตรวจสอบ [README.md](README.md)

