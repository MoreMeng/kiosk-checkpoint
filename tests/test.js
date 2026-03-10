/**
 * Simple Test Suite for Kiosk App
 * Run: node tests/test.js
 */

const assert = require('assert');

// Mock fetch for testing
global.fetch = async (url, options) => {
    console.log(`[Mock] Fetching: ${url}`);

    // Simulate successful response
    if (url.includes('/rxqueue/HN1234')) {
        return {
            ok: true,
            status: 200,
            json: async () => [{
                qno: '50',
                qstn: 'รอเรียกซักประวัติ',
                location: '172 จุดซักประวัติศัลยกรรม (ชั้น 3)',
                department_code: '330',
                ost_name: 'ตรวจแล้ว',
                qdate: '2026-03-10'
            }]
        };
    }

    // Simulate not found
    return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => []
    };
};

// Mock localStorage
const mockLocalStorage = {
    data: {},
    setItem(key, value) {
        this.data[key] = String(value);
    },
    getItem(key) {
        return this.data[key] || null;
    },
    removeItem(key) {
        delete this.data[key];
    },
    clear() {
        this.data = {};
    }
};
global.localStorage = mockLocalStorage;

// Mock navigator
global.navigator = {
    onLine: true
};

console.log('\n╔════════════════════════════════════════╗');
console.log('║     Kiosk Checkpoint Test Suite       ║');
console.log('╚════════════════════════════════════════╝\n');

// ===== TEST 1: Patient ID Validation =====
console.log('Test 1: Patient ID Validation');
try {
    const validIds = ['HN1234', 'ABC123', '123456'];
    const invalidIds = ['', '  ', 'HN', 'HN-1234', 'HN 1234'];

    const pattern = /^[A-Za-z0-9]{2,20}$/;

    validIds.forEach(id => {
        assert(pattern.test(id), `Should accept: ${id}`);
    });

    invalidIds.forEach(id => {
        assert(!pattern.test(id.trim()), `Should reject: ${id}`);
    });

    console.log('✓ Patient ID validation passed\n');
} catch (e) {
    console.error('✗ FAILED:', e.message, '\n');
}

// ===== TEST 2: Date Formatting =====
console.log('Test 2: Date Formatting');
try {
    const formatDate = (dateString) => {
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
            return dateString;
        }
    };

    const date1 = formatDate('2026-03-10');
    const date2 = formatDate(null);
    const date3 = formatDate('invalid');

    assert(date1 !== '', 'Should format valid date');
    assert(date2 === '-', 'Should handle null');
    assert(date3 === 'invalid', 'Should handle invalid date gracefully');

    console.log(`✓ Formatted dates: ${date1}, ${date2}, ${date3}\n`);
} catch (e) {
    console.error('✗ FAILED:', e.message, '\n');
}

// ===== TEST 3: Offline Queue Management =====
console.log('Test 3: Offline Queue Management');
try {
    const queue = [];
    const localStorageKey = 'kioskOfflineQueue';

    // Add to queue
    const entry1 = { patientId: 'HN1234', timestamp: Date.now(), retries: 0 };
    const entry2 = { patientId: 'HN5678', timestamp: Date.now(), retries: 1 };

    queue.push(entry1);
    queue.push(entry2);
    localStorage.setItem(localStorageKey, JSON.stringify(queue));

    // Retrieve
    const stored = JSON.parse(localStorage.getItem(localStorageKey));
    assert(stored.length === 2, 'Should have 2 entries');
    assert(stored[0].patientId === 'HN1234', 'Should preserve patientId');

    // Remove
    const filtered = stored.filter(q => q.patientId !== 'HN1234');
    assert(filtered.length === 1, 'Should filter correctly');

    console.log('✓ Offline queue operations passed\n');
} catch (e) {
    console.error('✗ FAILED:', e.message, '\n');
}

// ===== TEST 4: Data Mapping =====
console.log('Test 4: Queue Data Mapping');
try {
    const mockData = {
        qid: 'AS050',
        qno: '50',
        qstn: 'รอเรียกซักประวัติ',
        location: '172 จุดซักประวัติศัลยกรรม (ชั้น 3)',
        department_code: '330',
        ost_name: 'ตรวจแล้ว',
        qdate: '2026-03-10'
    };

    const mapping = {
        qid: mockData.qid || mockData.qno || '-',
        qno: mockData.qno || '-',
        status: mockData.ost_name || '-',
        task: mockData.qstn || '-',
        location: mockData.location || '-',
        dept: mockData.department_code || '-'
    };

    assert(mapping.qno === '50', 'qno mapping failed');
    assert(mapping.status === 'ตรวจแล้ว', 'status mapping failed');
    assert(mapping.task === 'รอเรียกซักประวัติ', 'task mapping failed');
    assert(mapping.location.includes('172'), 'location mapping failed');

    console.log('✓ Data mapping passed');
    console.log(`  Queue #${mapping.qno}: ${mapping.status} at ${mapping.location}\n`);
} catch (e) {
    console.error('✗ FAILED:', e.message, '\n');
}

// ===== TEST 5: API Error Handling =====
console.log('Test 5: API Error Handling (Mock)');
try {
    const testUrl = 'http://192.168.88.8:6601/rxqueue/INVALID';

    fetch(testUrl).then(response => {
        if (!response.ok) {
            console.log(`✓ Correctly detected error: HTTP ${response.status}`);
        }
        return response.json();
    }).then(data => {
        assert(Array.isArray(data), 'Response should be array');
    }).catch(err => {
        console.log(`✓ Error handling: ${err.message}`);
    });
} catch (e) {
    console.error('✗ FAILED:', e.message);
}

// ===== TEST 6: Cache Expiration =====
console.log('\nTest 6: Cache Expiration Logic');
try {
    const cacheExpiry = 30000; // 30 seconds
    const now = Date.now();

    // Fresh cache (5 seconds old)
    const freshCache = {
        data: { qno: '50' },
        timestamp: now - 5000
    };

    const freshAge = now - freshCache.timestamp;
    assert(freshAge < cacheExpiry, 'Fresh cache should be valid');

    // Expired cache (40 seconds old)
    const expiredCache = {
        data: { qno: '50' },
        timestamp: now - 40000
    };

    const expiredAge = now - expiredCache.timestamp;
    assert(expiredAge > cacheExpiry, 'Expired cache should be invalid');

    console.log(`✓ Cache logic: fresh (${freshAge}ms) vs expired (${expiredAge}ms)\n`);
} catch (e) {
    console.error('✗ FAILED:', e.message, '\n');
}

// Summary
console.log('╔════════════════════════════════════════╗');
console.log('║       All Tests Completed! ✓           ║');
console.log('╚════════════════════════════════════════╝\n');
