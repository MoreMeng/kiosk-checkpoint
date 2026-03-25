/**
 * CSV Logger Module - บันทึกข้อมูลการสแกน
 * เก็บข้อมูลในรูปแบบ CSV ที่สามารถนำไปใช้ต่อได้
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../logs');
const CSV_FILENAME = 'scan_logs.csv';
const CSV_HEADERS = 'วันที่,เวลา,ข้อมูลที่สแกน\n';

class ScanLogger {
    constructor() {
        this.logsDir = LOGS_DIR;
        this.csvFile = path.join(this.logsDir, CSV_FILENAME);
        this.initLogDirectory();
    }

    /**
     * สร้าง directory สำหรับเก็บ logs ถ้ายังไม่มี
     */
    initLogDirectory() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
            console.log(`[Logger] Created logs directory: ${this.logsDir}`);
        }

        // สร้าง CSV file ถ้ายังไม่มี
        if (!fs.existsSync(this.csvFile)) {
            fs.writeFileSync(this.csvFile, CSV_HEADERS, 'utf-8');
            console.log(`[Logger] Created CSV file: ${this.csvFile}`);
        }
    }

    /**
     * บันทึกข้อมูลการสแกน
     * @param {string} scannedData - ข้อมูลที่สแกนได้ (QR/Barcode)
     */
    logScan(scannedData) {
        try {
            // รับเวลาปัจจุบัน
            const now = new Date();
            const date = now.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });
            const time = now.toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });

            // เตรียม CSV row (escape quotes ในข้อมูล)
            const escapedData = scannedData.replace(/"/g, '""');
            const csvRow = `${date},${time},"${escapedData}"\n`;

            // เขียนลงไฟล์
            fs.appendFileSync(this.csvFile, csvRow, 'utf-8');

            console.log(`[Logger] Scan logged: ${date} ${time} - ${scannedData}`);
            return { success: true, message: 'Scan logged successfully' };

        } catch (error) {
            console.error(`[Logger Error] Failed to log scan:`, error.message);
            return { success: false, message: error.message };
        }
    }

    /**
     * อ่านข้อมูล logs ทั้งหมด (สำหรับการตรวจสอบ)
     */
    readLogs() {
        try {
            const content = fs.readFileSync(this.csvFile, 'utf-8');
            const lines = content.trim().split('\n');
            return {
                success: true,
                count: Math.max(0, lines.length - 1), // ลบ header row
                data: content
            };
        } catch (error) {
            console.error(`[Logger Error] Failed to read logs:`, error.message);
            return { success: false, message: error.message };
        }
    }

    /**
     * ล้าง logs (สำหรับการทดสอบ)
     */
    clearLogs() {
        try {
            fs.writeFileSync(this.csvFile, CSV_HEADERS, 'utf-8');
            console.log(`[Logger] Logs cleared`);
            return { success: true, message: 'Logs cleared' };
        } catch (error) {
            console.error(`[Logger Error] Failed to clear logs:`, error.message);
            return { success: false, message: error.message };
        }
    }

    /**
     * ดาวน์โหลด CSV file
     */
    getLogsFile() {
        return this.csvFile;
    }
}

// Export
module.exports = new ScanLogger();
