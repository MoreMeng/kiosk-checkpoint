/**
 * Main App Logic - Orchestrator
 */

class KioskApp {
    constructor() {
        this.apiClient = new QueueAPIClient();
        this.scanner = null;
        this.autoReturnTimeout = null;
        this.countdownInterval = null;
        this.slideshowInterval = null;
        this.slideshowIndex = 0;
        this.slideshowSlides = null;

        // Screens
        this.screens = {
            idle: document.getElementById('idleScreen'),
            loading: document.getElementById('loadingScreen'),
            error: document.getElementById('errorScreen'),
            result: document.getElementById('resultScreen')
        };

        this.init();
    }

    init() {
        // Initialize barcode scanner
        this.scanner = new BarcodeScanner((barcode) => {
            this.handleBarcodeScan(barcode);
        });

        // Check initial network status
        this.updateNetworkStatus();

        // Show idle screen
        this.showScreen('idle');

        // Detect and start image slideshow
        this.initSlideshow();
    }

    /**
     * Handle barcode scan
     */
    async handleBarcodeScan(barcode) {
        // Extract patient ID (HN) - strip whitespace and convert to uppercase
        const patientId = barcode.trim().toUpperCase();

        // Validate format
        const validationResult = this.isValidQueueNumber(patientId);
        if (!validationResult.valid) {
            this.showError(validationResult.message);
            this.showScreen('error');
            this.scheduleAutoReturn(10);
            return;
        }

        // Show loading with scanned data
        this.showScreen('loading');
        this.updateLoadingMessage('สแกนข้อมูล: ' + patientId + '\n\nกำลังค้นหาข้อมูล...');

        try {
            // Fetch queue status
            const queueData = await this.apiClient.getQueueStatus(patientId);

            // Clear loading state
            this.updateLoadingMessage('');

            // Display results
            this.displayQueueData(queueData);

            // Show result screen
            this.showScreen('result');

            // Schedule auto-return
            this.scheduleAutoReturn(15); // 15 seconds

        } catch (error) {
            console.error('[App] Error:', error.message);

            // ถ้า offline ให้ enqueue
            if (!this.apiClient.isOnline()) {
                this.apiClient.enqueueOfflineRequest(patientId);
                this.showError(
                    'ไม่สามารถเชื่อมต่อได้\n\n' +
                    'ระบบได้บันทึกรหัส: ' + patientId + '\n' +
                    'จะทดลองส่งอีกครั้งเมื่อเชื่อมต่อได้'
                );
            } else {
                this.showError('ไม่พบข้อมูล\n\nกรุณาตรวจสอบเลขคิวของท่านอีกครั้ง');
            }

            this.showScreen('error');
            this.scheduleAutoReturn(10); // Return faster on error
        }
    }

    /**
     * Display queue data on result screen
     */
    displayQueueData(data) {
        const mapping = {
            source: data.source || '-',
            qid: data.qid || data.qno || '-',
            status: data.qstn || '-',
            cdate: data.cdate || 'รอเรียกคิว',
            location: data.location || '-'
        };

        // Update DOM
        document.getElementById('queueSource').textContent = mapping.source;
        document.getElementById('queueQid').textContent = mapping.qid;
        document.getElementById('queueStatus').textContent = mapping.status;
        document.getElementById('queueCdate').textContent = mapping.cdate;
        document.getElementById('queueLocation').textContent = mapping.location;
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        // Convert newlines to <br> for proper display
        errorElement.innerHTML = message.replace(/\n/g, '<br>');
    }

    /**
     * Update loading message
     */
    updateLoadingMessage(message) {
        const loadingElement = document.getElementById('loadingMessage');
        // Convert newlines to <br> for proper display
        loadingElement.innerHTML = message.replace(/\n/g, '<br>');
    }

    /**
     * Switch screen
     */
    showScreen(screenName) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });

        // Show selected screen
        const screen = this.screens[screenName];
        if (screen) {
            screen.classList.add('active');
        }

        if (screenName === 'idle') {
            this.startSlideshow();
        } else {
            this.stopSlideshow();
        }
    }

    /**
     * Auto-detect images/1-5.(png|jpg|jpeg|webp) and build slideshow
     */
    async initSlideshow() {
        const extensions = ['png', 'jpg', 'jpeg', 'webp'];
        const found = [];

        for (let i = 1; i <= 5; i++) {
            for (const ext of extensions) {
                const path = `images/${i}.${ext}`;
                const exists = await new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                    img.src = path;
                });
                if (exists) {
                    found.push(path);
                    break;
                }
            }
        }

        const container = document.getElementById('idleSlideshow');
        if (!container || found.length === 0) return;

        container.innerHTML = '';
        found.forEach((src, index) => {
            const slide = document.createElement('div');
            slide.className = 'idle-slide' + (index === 0 ? ' active' : '');
            const img = document.createElement('img');
            img.src = src;
            img.alt = '';
            img.draggable = false;
            slide.appendChild(img);
            container.appendChild(slide);
        });

        this.slideshowSlides = container.querySelectorAll('.idle-slide');
        this.slideshowIndex = 0;

        // Auto-start if idle screen is currently active
        if (this.screens.idle && this.screens.idle.classList.contains('active')) {
            this.startSlideshow();
        }
    }

    startSlideshow() {
        this.stopSlideshow();
        if (!this.slideshowSlides || this.slideshowSlides.length <= 1) return;
        this.slideshowInterval = setInterval(() => {
            this._nextSlideshowSlide();
        }, 30000);
    }

    stopSlideshow() {
        if (this.slideshowInterval) {
            clearInterval(this.slideshowInterval);
            this.slideshowInterval = null;
        }
    }

    _nextSlideshowSlide() {
        if (!this.slideshowSlides || this.slideshowSlides.length === 0) return;
        this.slideshowSlides[this.slideshowIndex].classList.remove('active');
        this.slideshowIndex = (this.slideshowIndex + 1) % this.slideshowSlides.length;
        this.slideshowSlides[this.slideshowIndex].classList.add('active');
    }

    /**
     * Schedule auto-return to idle screen
     */
    scheduleAutoReturn(seconds) {
        // Clear any existing timeout
        if (this.autoReturnTimeout) {
            clearTimeout(this.autoReturnTimeout);
        }

        // Clear any existing countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        this.updateCountdown(seconds);

        // Update every second
        let remaining = seconds;
        this.countdownInterval = setInterval(() => {
            remaining--;
            this.updateCountdown(remaining);

            if (remaining <= 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                this.returnToIdle();
            }
        }, 1000);
    }

    /**
     * Update countdown display
     */
    updateCountdown(seconds) {
        const resultElement = document.getElementById('returnCountdown');
        const errorElement = document.getElementById('errorCountdown');

        if (resultElement) {
            resultElement.textContent = seconds;
        }
        if (errorElement) {
            errorElement.textContent = seconds;
        }
    }

    /**
     * Return to idle screen
     */
    returnToIdle() {
        // Cancel any pending auto-return
        if (this.autoReturnTimeout) {
            clearTimeout(this.autoReturnTimeout);
            this.autoReturnTimeout = null;
        }

        // Clear countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        this.showScreen('idle');
    }

    /**
     * Validate queue number against supported patterns
     * Pattern 1 (AS050): digit + uppercase letter + 3 digits (e.g., 1B205)
     * Pattern 2 (OPD): two letters + 3 digits (e.g., CS005)
     */
    isValidQueueNumber(queueNo) {
        if (!queueNo || queueNo.length === 0) {
            return {
                valid: false,
                message: 'ไม่พบข้อมูล'
            };
        }

        // Pattern 1: digit + uppercase letter + 3 digits e.g. 1B205
        const rxPattern = /^[0-9][A-Z][0-9]{3}$/;
        // Pattern 2: two letters + 3 digits e.g. CS005
        const opdPattern = /^[A-Z]{2}[0-9]{3}$/;

        if (rxPattern.test(queueNo) || opdPattern.test(queueNo)) {
            return { valid: true };
        }

        return {
            valid: false,
            message: 'ข้อมูลไม่ถูกต้อง\nระบบรองรับเฉพาะใบคิวรับบริการเท่านั้น\nโปรดสแกนใหม่'
        };
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return '-';

        try {
            const date = new Date(dateString);
            const options = {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            };
            return date.toLocaleDateString('th-TH', options);
        } catch (e) {
            console.error('[App] Date format error:', e);
            return dateString;
        }
    }

    /**
     * Update network status indicator
     */
    updateNetworkStatus() {
        const indicator = document.getElementById('offlineIndicator');
        if (!navigator.onLine && indicator) {
            indicator.classList.remove('hidden');
        } else if (indicator) {
            indicator.classList.add('hidden');
        }
    }

    // === Test/Debug Methods ===

    /**
     * Simulate barcode scan (for testing)
     * Usage: app.testScan('HN1234')
     */
    testScan(barcode) {
        if (this.scanner) {
            this.scanner.simulateScan(barcode);
        }
    }

    /**
     * Show offline queue (for debugging)
     */
    showOfflineQueue() {
        const queue = this.apiClient.getOfflineQueue();
        return queue;
    }

    /**
     * Clear offline queue
     */
    clearOfflineQueue() {
        this.apiClient.saveOfflineQueue([]);
    }
}

// ===== Initialize App on DOMContentLoaded =====
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new KioskApp();

    // Make app available globally for debugging
    window.app = app;
});

// Handle page visibility (tab focus)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page hidden
    } else {
        app.updateNetworkStatus();
    }
});

// Log unhandled errors
window.addEventListener('error', (event) => {
    console.error('[Error]', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
});
