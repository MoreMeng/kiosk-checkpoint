# Logging Feature - บันทึกข้อมูลการสแกน

## Overview
ระบบ Kiosk Checkpoint ขณะนี้มีฟีเจอร์สำหรับบันทึกข้อมูลการสแกนลง CSV file ที่เก็บไว้ในเครื่อง

## Features

### 1. **Automatic Scan Logging**
- ทุกครั้งที่มีการสแกน QR/Barcode ระบบจะบันทึกข้อมูลลงไฟล์ CSV อัตโนมัติ
- บันทึกข้อมูล:
  - **วันที่** - รูปแบบ DD/MM/YYYY
  - **เวลา** - รูปแบบ HH:MM:SS
  - **ข้อมูลที่สแกน** - QR code หรือ Barcode ที่อ่านได้

### 2. **CSV Format**
```
วันที่,เวลา,ข้อมูลที่สแกน
25/03/2569,14:30:45,"1B205"
25/03/2569,14:32:10,"CS010"
```

### 3. **File Location**
- ไฟล์เก็บอยู่ที่: `logs/scan_logs.csv`
- สร้างขึ้นอัตโนมัติเมื่อเซิร์ฟเวอร์เริ่มทำงาน

## API Endpoints

### 1. **Log Scan Data (POST)**
```
POST /api/logs
Content-Type: application/json

{
  "scannedData": "1B205",
  "status": "valid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Scan logged successfully"
}
```

### 2. **Retrieve All Logs (GET)**
```
GET /api/logs
```

**Response:**
```json
{
  "success": true,
  "count": 42,
  "data": "วันที่,เวลา,ข้อมูลที่สแกน\n25/03/2569,14:30:45,\"1B205\"\n..."
}
```

### 3. **Download CSV File**
```
GET /api/logs/download
```
ดาวน์โหลดไฟล์ `scan_logs.csv` โดยตรง

### 4. **Clear Logs (DELETE)** ⚠️
```
DELETE /api/logs/clear
```
ล้างข้อมูล logs ทั้งหมด (สำหรับการทดสอบเท่านั้น)

## Usage

### บนเซิร์ฟเวอร์
```bash
# เซิร์ฟเวอร์จะสร้างโฟลเดอร์ logs และไฟล์ CSV อัตโนมัติ
# ไฟล์จะเก็บใน: server/../logs/scan_logs.csv
node server/index.js
```

### บน Client (ระบบจะทำอัตโนมัติ)
```javascript
// app.js จะเรียก logScanData อัตโนมัติเมื่อมีการสแกน
this.logScanData(patientId, 'valid');
```

### เช็คไฟล์ Log บนเซิร์ฟเวอร์
```bash
# ดูเนื้อหา CSV
cat logs/scan_logs.csv

# นับจำนวนรายการที่สแกน (ลบ header)
wc -l logs/scan_logs.csv
```

## Troubleshooting

### ไม่เห็นไฟล์ logs
- ตรวจสอบว่า server กำลังทำงานอยู่
- ตรวจสอบสิทธิ์ดูเเล folder: `logs/` อย่างน้อย read/write

### ข้อมูลไม่ถูกบันทึก
- เช็ค console log ที่ server: `[Logger] Scan logged: ...`
- ตรวจสอบการเชื่อมต่อระหว่าง client กับ server

### CSV มีข้อมูล corrupt
- ไฟล์ CSV มีการ escape ข้อมูลที่มี quote/comma อยู่แล้ว
- เปิดด้วย Excel, Google Sheets, หรือ Text Editor ได้ปกติ

## Data Backup

### เพื่อสำรอง logs
```bash
# Copy ไฟล์
cp logs/scan_logs.csv logs/scan_logs_backup_20260325.csv

# หรือใช้ API
curl http://localhost:8080/api/logs/download > logs_backup.csv
```

## Implementation Details

### Files Modified:
1. **server/logger.js** (New)
   - ScanLogger class ควบคุมการบันทึก CSV
   - Methods: logScan(), readLogs(), clearLogs(), getLogsFile()

2. **server/index.js**
   - Import logger module
   - เพิ่ม endpoints: /api/logs (POST/GET), /api/logs/download, /api/logs/clear

3. **public/js/app.js**
   - เพิ่ม logScanData() method
   - เรียก logScanData() ใน handleBarcodeScan()

## Thai Locale Support
- วันที่ใช้รูปแบบไทย (DD/MM/YYYY) และปี พ.ศ.
- เวลาใช้รูปแบบ 24 ชั่วโมง
- ทุก headers และ log messages เป็นภาษาไทย
