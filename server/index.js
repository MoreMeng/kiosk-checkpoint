/**
 * Simple HTTP Server - ให้ใช้ serve static files
 * ใช้ Node.js built-in http module ไม่ต้อง dependencies เพิ่มเติม
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const scanLogger = require('./logger');

const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, '../public');

// MIME type mapping
const mimeTypes = {
    '.html': 'text/html;charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // ✅ API Proxy - forward to backend (/rxqueue/:patientId)
    if (pathname.startsWith('/api/rxqueue/')) {
        const patientId = pathname.replace('/api/rxqueue/', '');
        const apiUrl = `http://192.168.88.8:6601/rxqueue/${patientId}`;

        console.log(`[PROXY] Forwarding to: ${apiUrl}`);

        http.get(apiUrl, (apiRes) => {
            let data = '';

            apiRes.on('data', chunk => {
                data += chunk;
            });

            apiRes.on('end', () => {
                res.writeHead(apiRes.statusCode, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        }).on('error', (err) => {
            console.error(`[PROXY ERROR] ${apiUrl}:`, err.message);
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API unavailable' }));
        });
        return;
    }

    // ✅ Logging API - บันทึกข้อมูลการสแกน
    if (pathname === '/api/logs' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const scannedData = payload.scannedData || payload.data;

                if (!scannedData) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'scannedData is required' }));
                    return;
                }

                const result = scanLogger.logScan(scannedData);

                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(result));

            } catch (error) {
                console.error('[Logging Error]', error.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // ✅ Retrieve logs - ดึงข้อมูล logs ทั้งหมด
    if (pathname === '/api/logs' && req.method === 'GET') {
        const result = scanLogger.readLogs();

        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result));
        return;
    }

    // ✅ Download logs CSV - ดาวน์โหลดไฟล์ CSV
    if (pathname === '/api/logs/download') {
        const logsFile = scanLogger.getLogsFile();

        fs.readFile(logsFile, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Logs file not found' }));
                return;
            }

            res.writeHead(200, {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="scan_logs.csv"',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content);
        });
        return;
    }

    // ✅ Clear logs - ล้าง logs (สำหรับการทดสอบ)
    if (pathname === '/api/logs/clear' && req.method === 'DELETE') {
        const result = scanLogger.clearLogs();

        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result));
        return;
    }

    // Default to index.html for root
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    // Prevent directory traversal attacks
    if (pathname.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad request');
        return;
    }

    const filePath = path.join(PUBLIC_DIR, pathname);

    // Check if file exists
    fs.stat(filePath, (err, stats) => {
        if (err) {
            // File not found
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 - File not found\n');
            console.log(`[404] ${pathname}`);
            return;
        }

        if (stats.isDirectory()) {
            // Try to serve index.html from directory
            const indexPath = path.join(filePath, 'index.html');
            fs.stat(indexPath, (err) => {
                if (err) {
                    res.writeHead(403, { 'Content-Type': 'text/plain' });
                    res.end('403 - Forbidden\n');
                    return;
                }

                serveFile(indexPath, res);
            });
            return;
        }

        serveFile(filePath, res);
    });
});

function serveFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 - Internal Server Error\n');
            console.error(`[500] Error reading ${filePath}:`, err.message);
            return;
        }

        // Add cache headers
        const cacheControl = ext === '.html'
            ? 'no-cache, no-store, must-revalidate'
            : 'public, max-age=3600';

        res.writeHead(200, {
            'Content-Type': mimeType,
            'Cache-Control': cacheControl,
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff'
        });

        res.end(content);
        console.log(`[200] ${filePath}`);
    });
}

// Health check endpoint
server.on('request', (req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        console.log('[Health] OK');
        return;
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════╗
║   Kiosk Checkpoint Server Started      ║
╠════════════════════════════════════════╣
║ Server: http://localhost:${PORT}      ║
║ Public: ${PUBLIC_DIR}    ║
║ Health: http://localhost:${PORT}/health║
╚════════════════════════════════════════╝
    `);
    console.log('Press Ctrl+C to stop server\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received - shutting down gracefully');
    server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[Server] SIGINT received - shutting down gracefully');
    server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
    });
});
