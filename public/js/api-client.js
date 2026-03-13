/**
 * API Client - ค้นหาสถานะคิวและ offline queue management
 */

class QueueAPIClient {
    constructor() {
        this.apiBaseUrl = 'http://192.168.88.8:6601';
        this.apiEndpoint = '/rxqueue';
        this.retryAttempts = 3;
        this.retryDelay = 1000; // ms
        this.cacheExpiry = 30000; // 30 seconds
        this.localStorageKey = 'kioskOfflineQueue';

        // ตรวจสอบ network status
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    /**
     * ค้นหาสถานะคิว
     * @param {string} patientId - HN (หมายเลขผู้ป่วย)
     * @returns {Promise<Object>} queue data
     */
    async getQueueStatus(patientId) {
        if (!patientId) {
            throw new Error('Patient ID is required');
        }

        // ✅ ใช้ proxy server เพื่อ bypass CORS (แทน direct API call)
        const url = `/api/rxqueue/${patientId}`;

        let lastError = null;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    timeout: 5000
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                // ตรวจสอบว่า data เป็น array และมีข้อมูล
                if (!Array.isArray(data) || data.length === 0) {
                    throw new Error('No queue data found');
                }

                // สำเร็จ - เอาข้อมูลแรก
                this.saveToCache(patientId, data[0]);
                return data[0];

            } catch (error) {
                lastError = error;

                if (attempt < this.retryAttempts) {
                    // รอก่อน retry
                    await this.sleep(this.retryDelay * attempt);
                }
            }
        }

        // ถ้า retry หมดแล้วให้ลองจาก cache
        const cached = this.getFromCache(patientId);
        if (cached) {
            return cached;
        }

        // ไม่จำเป็นต้องโยน error เราจะ enqueue offline
        throw lastError || new Error('Failed to fetch queue status after retries');
    }

    /**
     * บันทึก offline queue สำหรับ retry
     */
    enqueueOfflineRequest(patientId) {
        const queue = this.getOfflineQueue();
        const entry = {
            patientId,
            timestamp: Date.now(),
            retries: 0
        };

        // ตรวจสอบว่าไม่มี duplicate
        if (!queue.some(q => q.patientId === patientId)) {
            queue.push(entry);
            this.saveOfflineQueue(queue);
        }
    }

    /**
     * Process offline queue เมื่อ network กลับมา
     */
    async processOfflineQueue() {
        const queue = this.getOfflineQueue();

        if (queue.length === 0) {
            return;
        }

        for (const entry of queue) {
            try {
                await this.getQueueStatus(entry.patientId);
                this.removeFromOfflineQueue(entry.patientId);
            } catch (error) {
                console.warn('[Offline] Failed to process:', entry.patientId, error.message);
                // เก็บไว้เพื่อ retry ครั้งหน้า
            }
        }
    }

    // === Local Storage / Cache Helpers ===

    saveToCache(patientId, data) {
        const cache = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(`queue_${patientId}`, JSON.stringify(cache));
    }

    getFromCache(patientId) {
        const cached = localStorage.getItem(`queue_${patientId}`);
        if (!cached) return null;

        try {
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            if (age > this.cacheExpiry) {
                localStorage.removeItem(`queue_${patientId}`);
                return null;
            }

            return data;
        } catch (e) {
            console.error('[Cache] Parse error:', e);
            return null;
        }
    }

    getOfflineQueue() {
        const queue = localStorage.getItem(this.localStorageKey);
        return queue ? JSON.parse(queue) : [];
    }

    saveOfflineQueue(queue) {
        localStorage.setItem(this.localStorageKey, JSON.stringify(queue));
    }

    removeFromOfflineQueue(patientId) {
        const queue = this.getOfflineQueue();
        const filtered = queue.filter(q => q.patientId !== patientId);
        this.saveOfflineQueue(filtered);
    }

    // === Network Status Handlers ===

    handleOnline() {
        document.getElementById('offlineIndicator')?.classList.add('hidden');
        this.processOfflineQueue();
    }

    handleOffline() {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }
    }

    // === Utilities ===

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isOnline() {
        return navigator.onLine;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QueueAPIClient;
}
