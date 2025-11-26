import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8888;
const PUBLIC_DIR = path.join(__dirname, 'public');

// In-memory data store
let events = [
    {
        id: '1',
        title: 'Sahabat Sejati',
        date: '2025-11-01',
        location: 'Jakarta',
        description: 'Konser musik persahabatan.',
        image: 'images/event1.webp'
    },
    {
        id: '2',
        title: 'Makan2',
        date: '2025-12-22',
        location: 'Bandung',
        description: 'Traktir',
        image: 'images/event1.webp'
    }
];

const registrations = [];

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
};

// Helper to parse request body
const parseBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            resolve(body);
        });
        req.on('error', (err) => {
            reject(err);
        });
    });
};

const server = http.createServer(async (req, res) => {
    console.log(`${req.method} ${req.url}`);

    // API Routes
    if (req.url === '/api/events' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(events));
        return;
    }

    if (req.url === '/api/login' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { email, password } = JSON.parse(body);

            if (email === 'admin' && password === 'admin') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
            }
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Bad Request' }));
        }
        return;
    }

    if (req.url === '/api/register' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const data = JSON.parse(body);
            registrations.push({ ...data, date: new Date().toISOString() });
            console.log('New Registration:', data);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false }));
        }
        return;
    }

    if (req.url === '/api/events' && req.method === 'POST') {
        // Handle Form Submission from Create Event Page
        try {
            const body = await parseBody(req);
            const params = new URLSearchParams(body);

            const newEvent = {
                id: Date.now().toString(),
                title: params.get('title'),
                date: params.get('date'),
                location: params.get('location'),
                description: params.get('description'),
                image: 'images/' + params.get('image') // Assume user types filename
            };

            events.push(newEvent);
            console.log('New Event:', newEvent);

            // Redirect back to dashboard
            res.writeHead(302, { 'Location': '/admin-dashboard.html' });
            res.end();
        } catch (e) {
            res.writeHead(500);
            res.end('Server Error');
        }
        return;
    }

    if (req.url.startsWith('/api/events/') && req.method === 'DELETE') {
        const id = req.url.split('/').pop();
        events = events.filter(e => e.id !== id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // Static File Serving
    let filePath = req.url === '/' ? '/index.html' : req.url;

    // Handle specific routes for cleaner URLs
    if (filePath === '/login') filePath = '/login.html';
    if (filePath === '/register') filePath = '/register-event.html';
    if (filePath === '/create-event') filePath = '/create-event.html';
    if (filePath === '/admin-dashboard') filePath = '/admin-dashboard.html';

    // Remove query strings
    filePath = filePath.split('?')[0];

    let extname = path.extname(filePath);
    let contentType = mimeTypes[extname] || 'application/octet-stream';

    // If no extension, assume HTML
    if (!extname && filePath.indexOf('.') === -1) {
        filePath += '.html';
        contentType = 'text/html';
    }

    const fullPath = path.join(PUBLIC_DIR, filePath);

    fs.readFile(fullPath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(path.join(PUBLIC_DIR, '404.html'), (error, content404) => {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(content404 || '404 Not Found', 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
