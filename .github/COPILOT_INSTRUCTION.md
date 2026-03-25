**Purpose**
- วัตถุประสงค์: ให้ AI/CoPilot agent สามารถสร้างระบบ Kiosk Checkpoint สำหรับโรงพยาบาล/คลินิก ที่ใช้ Raspberry Pi และ barcode/QR scanner เพื่อให้ผู้ป่วยสแกนใบนำทางแล้วเห็นสถานะการรักษาแบบอัตโนมัติ

**Scope (ขอบเขตที่ agent ต้องทราบ)**
- ต้องเชื่อมต่อกับ API: host:port/rxqueue/:id โดย `:id` = HN (รหัสคนไข้)
- ต้องเรียก API โดยตรงที่: `GET http://192.168.88.8:6601/rxqueue/{{queueid}} HTTP/1.1` โดย `{{queueid}}` = HN (รหัสคนไข้)
- หมายเหตุ: ระบบนี้ออกแบบเป็น front-end อย่างเดียว — ไม่จำเป็นต้องมี proxy/server บนเครื่อง local; ให้แอปหน้าจอเรียก API ตรงไปยัง `192.168.88.8:6601` (ต้องให้ backend รองรับ CORS หรือวางเครือข่ายให้อยู่ในวงเดียวกัน)
- แสดงข้อมูลการคิวที่ได้จาก API ให้ผู้ป่วยเห็น (อ่านง่าย ขนาดตัวอักษรใหญ่)
- ทำงานบน Raspberry Pi (headless except display) และต่อกับ barcode/QR scanner (USB HID หรือ serial)
- ทำงานเป็น kiosk — อัตโนมัติเมื่อเปิดเครื่อง (ไม่มีเมาส์/คีย์บอร์ด)
- ต้องรองรับการทำงาน offline ชั่วคราว (เก็บคิวที่สแกนไว้ และ retry เมื่อเชื่อมต่อได้)
- รองรับการแจ้งเตือนเสียง/ภาพเมื่อสถานะเปลี่ยน (option)

**API Spec & Example**
- Endpoint (fixed): `GET http://192.168.88.8:6601/rxqueue/{{queueid}}`  (HTTP/1.1)
- :id / `{{queueid}}` รับค่าเป็น HN ของผู้ป่วย
- Note: Front-end must call this endpoint directly. Ensure the backend allows CORS from the kiosk origin or place kiosk and backend on the same LAN.
- Response: JSON array ของ queue objects (ตัวอย่าง):

```
// คิวห้องตรวจ
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
// ติวห้องยา
[
  {
    "source": "คิวห้องยา",
    "ref_id": 448557,
    "qid": "1B055",
    "qno": "1",
    "qstn": "จ่ายยา",
    "queue_priority": 99,
    "qdate": "2026-03-10",
    "cdate": "2026-03-10 10:19:39",
    "location": "397 ห้องจ่ายยานอกชั้น 2",
    "department_code": "397",
    "ost_name": "จ่ายยา"
  }
]
```

**Field mapping (แนะนำการแสดงผล)**
- `qid` / `qno`: หมายเลขคิว (ใหญ่, เด่น)
- `qstn`: สถานะปัจจุบัน (เช่น รอเรียก/กำลังตรวจ)
- `location`: จุดที่ต้องไป (แสดงชัดเจน)
- `qdate`: วันที่ของคิว
- `ost_name`: สถานะการตรวจ (ถ้ามี)

**Hardware & OS Requirements**
- Raspberry Pi 4 (หรือสูงกว่า) พร้อมจอสัมผัสหรือจอปกติ
- OS: Raspberry Pi OS (32/64-bit) หรือ Debian-based distro
- Barcode/QR scanner: USB HID (keyboard wedge) หรือ serial/USBที่รองรับ
- กล้อง (ถ้าใช้ camera-based QR scanning)

**Scanner integration guidance**
- Preferred: USB barcode scanner configured as HID -> ส่งค่าเป็นสตริง + Enter
- Alternate: Serial scanner (สร้าง daemon อ่านจาก /dev/ttyUSB0)
- Camera: ใช้ library (zbar/ZXing) อ่าน QR code จากกล้อง
- เมื่อได้รับ input ให้ strip whitespace แล้วใช้เป็น `:id` ในการเรียก API

**App Behavior & UX Requirements**
- Kiosk startup: แอปต้องรันอัตโนมัติเมื่อบูท (systemd หรือ autostart)
- Idle screen: แสดงคำแนะนำให้สแกนใบแจ้ง (ใหญ่, อ่านง่าย)
- On-scan: แสดง loading -> call API -> แสดงผลแบบการ์ด (สถานะ, เลขคิว, สถานที่)
- Error states: Network error, no record found, malformed code -> แจ้งผู้ใช้ด้วยข้อความที่เข้าใจง่าย
- Accessibility: ตัวอักษรใหญ่, contrast สูง, ปุ่มย้อนกลับ (ถ้าจำเป็น) แต่โดยหลักไม่มีคีย์บอร์ด
- Auto-close / auto-return: หลังแสดงผล 10–30 วินาที ให้กลับไปหน้า idle
- Optional: เสียงแจ้งหรือ TTS เมื่อสถานะเปลี่ยน

**Offline & Retry Strategy**
- หาก API ไม่ตอบ: เก็บ HN ที่สแกนและสถานะ timestamp ไว้ใน local queue (SQLite or file)
- ทำ background retry เมื่อมี network; พยายามเรียงลำดับการส่งตาม timestamp
- หาก offline นาน ให้แสดงข้อความแนะนำให้ติดต่อเจ้าหน้าที่

**Security & Network**
- เข้ารหัสการเชื่อมต่อ (HTTPS) ถ้าเป็นไปได้
- ระบุเวลาหมดอายุของ cache ผลลัพธ์ (e.g., 30s)
- Log เฉพาะ metadata (หลีกเลี่ยงเก็บข้อมูลส่วนตัวเกินจำเป็น)

**Deployment / Autostart (Raspberry Pi)**
- วิธีแนะนำ: ทำเป็น progressive web app หรือ kiosk web app + run Chromium in kiosk mode
  - Chromium command example (systemd autostart):

```
chromium-browser --noerrdialogs --kiosk --incognito --disable-translate --disable-infobars http://localhost:8080
```

- หรือ: ทำเป็น Electron app / Python GUI (Kivy/PyQt) แล้วสร้าง `systemd` service ที่รันตอนบูท
- สร้าง service: `kiosk.service` (auto-restart, start after network-online.target)

**Logging & Monitoring**
- Local logs (rotate): scanner reads, API results, errors
- Scan logging: บันทึก QR/Barcode ที่สแกนลง CSV file เพื่อการตรวจสอบและวิเคราะห์
  - Format: `วันที่,เวลา,ข้อมูลที่สแกน` (Thai locale with DD/MM/YYYY and HH:MM:SS)
  - Location: `logs/scan_logs.csv` บนเซิร์ฟเวอร์
  - API endpoints: POST /api/logs (log scan), GET /api/logs, GET /api/logs/download, DELETE /api/logs/clear
- Optional: ส่ง health ping ไปยัง central server (status up/down)

**Testing & Acceptance Criteria**
- Unit / Integration:
  - Scanner input ถูกแปลงเป็น HN ถูกต้อง (trim, remove non-numeric if needed)
  - เรียก `GET /rxqueue/:id` แล้ว parse response ได้
  - UI แสดงข้อมูลตาม mapping ข้างต้น
  - Offline workflow: เก็บคิวและ retry สำเร็จเมื่อ network กลับมา
- Acceptance:
  - เมื่อสแกนบาร์โค้ดจริงบน Raspberry Pi ระบบแสดงสถานะคิวภายใน 2–5 วินาที (เมื่อเน็ตปกติ)
  - ระบบกลับไปหน้า idle อัตโนมัติหลัง 15s
  - ไม่มีการต้องใช้เมาส์/คีย์บอร์ดในการใช้งานปกติ

**Deliverables (สิ่งที่ agent ควรสร้าง)**
- Project scaffold: frontend (static web or Electron) และ backend helper (ถ้าจำเป็น)
- Scanner input handler module (USB HID and serial examples)
- Network client module calling `rxqueue/:id` พร้อม retry และ timeout handling
- UI screens: idle, loading, result, error
- Logging module: บันทึกข้อมูลการสแกนลง CSV file
- Deployment scripts: `systemd` unit, README deployment steps for Raspberry Pi
- Tests: basic automated tests (unit for parsing + integration mock for API)

**Priority tasks for first iteration**
1. Build minimal kiosk web app that: reads scanner input, calls API, shows results
2. Add autostart instructions for Raspberry Pi (systemd + chromium kiosk)
3. Add offline queueing and retry logic
4. Add scan logging (CSV file) for auditing and analysis
5. Add logging and simple health check endpoint

**Notes for developer/agent implementation**
- Assume scanner sends a single line ending with Enter. If not, provide alternate serial reader.
- Use a small, maintainable stack (e.g., React or plain HTML/JS for UI; lightweight Node.js/Express helper if needed)
- Keep UI simple and legible for patients (no complex interactions)
- Logging: เก็บข้อมูลการสแกนลง CSV ที่สามารถใช้วิเคราะห์ได้ โดยบันทึก วันที่ เวลา และข้อมูลที่สแกน
- CSV module: ใช้ Node.js fs module อ่าน/เขียนไฟล์ – ไม่ต้องใช้ library เพิ่มเติม

**Next steps (what I can implement if you want)**
- สร้าง scaffold โปรเจกต์ตัวอย่าง (frontend + systemd config)
- เขียนโมดูลอ่าน barcode HID และตัวอย่างการทดสอบกับ mock API
- สร้าง README พร้อมคำสั่ง deploy บน Raspberry Pi
- ✅ **[COMPLETED v1.0.0]** Implementation of scan logging feature (Issue #15)
  - CSV logger module (`server/logger.js`)
  - Logging API endpoints
  - Frontend integration for automatic logging
  - Documentation in `LOGGING_FEATURE.md`

--
เขียนโดย: คำสั่งสำหรับ CoPilot agent — ถ้าต้องการให้ผม scaffold โปรเจกต์จริง ๆ ให้ตอบว่า "เริ่ม scaffold" พร้อมบอกว่าจะใช้ web-app (Chromium kiosk) หรือ native app (Electron/Python)
