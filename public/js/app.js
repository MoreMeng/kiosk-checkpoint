/**
 * Main App Logic - Orchestrator
 */

class KioskApp {
    constructor() {
        this.apiClient = new QueueAPIClient();
        this.scanner = null;
        this.autoReturnTimeout = null;

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
        console.log('[App] Initializing Kiosk App');

        // Initialize barcode scanner
        this.scanner = new BarcodeScanner((barcode) => {
            this.handleBarcodeScan(barcode);
        });

        // Check initial network status
        this.updateNetworkStatus();

        // Show idle screen
        this.showScreen('idle');

        console.log('[App] Ready');
    }

    /**
     * Handle barcode scan
     */
    async handleBarcodeScan(barcode) {
        console.log('[App] Handling barcode scan:', barcode);

        // Extract patient ID (HN) - strip whitespace and non-numeric chars if needed
        const patientId = barcode.trim();

        if (!this.isValidPatientId(patientId)) {
            this.showError('รหัสผู้ป่วยไม่ถูกต้อง: ' + patientId);
            return;
        }

        // Show loading
        this.showScreen('loading');
        this.updateLoadingMessage('กำลังค้นหาข้อมูล...');

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
                    'ระบบได้บันทึกรหัสของคุณ\n' +
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
        console.log('[App] Displaying queue data:', data);

        const mapping = {
            source: data.source || '-',
            qid: data.qid || data.qno || '-',
            status: data.qstn || '-',
            cdate: data.cdate || '-',
            location: data.location || '-'
        };

        // Update DOM
        document.getElementById('queueSource').textContent = mapping.source;
        document.getElementById('queueQid').textContent = mapping.qid;
        document.getElementById('queueStatus').textContent = mapping.status;
        document.getElementById('queueCdate').textContent = mapping.cdate;
        document.getElementById('queueLocation').textContent = mapping.location;

        console.log('[App] Queue display updated');
    }

    /**
     * Show error message
     */
    showError(message) {
        console.log('[App] Showing error:', message);
        document.getElementById('errorMessage').textContent = message;
    }

    /**
     * Update loading message
     */
    updateLoadingMessage(message) {
        document.getElementById('loadingMessage').textContent = message;
    }

    /**
     * Switch screen
     */
    showScreen(screenName) {
        console.log('[App] Showing screen:', screenName);

        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });

        // Show selected screen
        const screen = this.screens[screenName];
        if (screen) {
            screen.classList.add('active');
        }
    }

    /**
     * Schedule auto-return to idle screen
     */
    scheduleAutoReturn(seconds) {
        // Clear any existing timeout
        if (this.autoReturnTimeout) {
            clearTimeout(this.autoReturnTimeout);
        }

        this.updateCountdown(seconds);

        // Update every second
        let remaining = seconds;
        const countdownInterval = setInterval(() => {
            remaining--;
            this.updateCountdown(remaining);

            if (remaining <= 0) {
                clearInterval(countdownInterval);
                this.returnToIdle();
            }
        }, 1000);
    }

    /**
     * Update countdown display
     */
    updateCountdown(seconds) {
        const element = document.getElementById('returnCountdown');
        if (element) {
            element.textContent = seconds;
        }
    }

    /**
     * Return to idle screen
     */
    returnToIdle() {
        console.log('[App] Returning to idle screen');

        // Cancel any pending auto-return
        if (this.autoReturnTimeout) {
            clearTimeout(this.autoReturnTimeout);
        }

        this.showScreen('idle');
    }

    /**
     * Validate patient ID
     */
    isValidPatientId(id) {
        // Patient ID should be alphanumeric, 2-20 chars
        const pattern = /^[A-Za-z0-9]{2,20}$/;
        return pattern.test(id);
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
            console.log('[App] Offline mode');
        } else if (indicator) {
            indicator.classList.add('hidden');
            console.log('[App] Online mode');
        }
    }

    // === Test/Debug Methods ===

    /**
     * Simulate barcode scan (for testing)
     * Usage: app.testScan('HN1234')
     */
    testScan(barcode) {
        console.log('[App] Test scan:', barcode);
        if (this.scanner) {
            this.scanner.simulateScan(barcode);
        }
    }

    /**
     * Show offline queue (for debugging)
     */
    showOfflineQueue() {
        const queue = this.apiClient.getOfflineQueue();
        console.log('[Debug] Offline queue:', queue);
        return queue;
    }

    /**
     * Clear offline queue
     */
    clearOfflineQueue() {
        this.apiClient.saveOfflineQueue([]);
        console.log('[Debug] Offline queue cleared');
    }
}

// ===== Initialize App on DOMContentLoaded =====
let app;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Main] DOM Content Loaded - Initializing app');
    app = new KioskApp();

    // Make app available globally for debugging
    window.app = app;
});

// Handle page visibility (tab focus)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('[App] Page hidden');
    } else {
        console.log('[App] Page visible');
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
