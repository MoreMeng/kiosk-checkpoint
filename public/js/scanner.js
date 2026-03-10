/**
 * Scanner Handler - USB HID Keyboard Wedge
 * บาร์โค้ด/QR reader ส่งข้อมูลมาเป็น keyboard input ลงท้ายด้วย Enter
 */

class BarcodeScanner {
    constructor(callback) {
        this.callback = callback;
        this.inputBuffer = '';
        this.timeoutId = null;
        this.readTimeout = 100; // ms - รอเพื่อให้อักขระเข้ามาหมด

        // ใช้ keydown event เพื่อให้ได้ทุก keypress
        document.addEventListener('keydown', (e) => this.handleKeydown(e));

        console.log('[Scanner] Barcode scanner initialized');
    }

    handleKeydown(event) {
        // ถ้า Enter ให้ส่งค่า
        if (event.key === 'Enter') {
            this.submitScan();
            return;
        }

        // เก็บอักขระ (ไม่เก็บ modifier keys)
        if (event.key.length === 1) {
            this.inputBuffer += event.key;

            // Clear timeout เก่า และสร้างใหม่
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }

            // Timeout: ถ้าไม่มีอักขระเข้ามา 100ms ให้ reset
            this.timeoutId = setTimeout(() => {
                if (this.inputBuffer && this.inputBuffer.length > 0) {
                    console.log('[Scanner] Timeout - auto-submit:', this.inputBuffer);
                    this.submitScan();
                }
            }, this.readTimeout);
        }
    }

    submitScan() {
        const barcode = this.inputBuffer.trim();

        if (barcode.length === 0) {
            console.log('[Scanner] Empty barcode, ignoring');
            return;
        }

        // Clear timeout กับ buffer
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.inputBuffer = '';

        console.log('[Scanner] Scan detected:', barcode);

        // Callback
        if (typeof this.callback === 'function') {
            this.callback(barcode);
        }
    }

    // Test method (สำหรับการทดสอบเมื่อไม่มี physical scanner)
    simulateScan(barcode) {
        console.log('[Scanner] Simulating scan:', barcode);
        this.inputBuffer = barcode;
        this.submitScan();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BarcodeScanner;
}
