import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8888;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(__dirname, 'events.db');

// Initialize Database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('[ERROR] ', err.message);
    } else {
        console.log('[INFO] Berhasil terhubung ke database SQLite');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Create Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )`);

        // Create Events Table
        db.run(`CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            date TEXT,
            location TEXT,
            description TEXT,
            image TEXT
        )`);

        // Create Registrations Table
        db.run(`CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            phone TEXT,
            event_name TEXT,
            date TEXT
        )`);

        // Seed Admin User
        db.get("SELECT * FROM users WHERE username = ?", ['admin'], (err, row) => {
            if (!row) {
                db.run("INSERT INTO users (username, password) VALUES (?, ?)", ['admin', 'admin'], (err) => {
                    if (err) console.error(err.message);
                    else console.log('[INFO] Membuat superuser dengan username (admin) dan password (admin)');
                });
            }
        });

        // Seed Initial Events if empty
        db.get("SELECT count(*) as count FROM events", (err, row) => {
            if (row.count === 0) {
                const initialEvents = [
                    {
                        title: 'Sahabat Sejati',
                        date: '2025-11-01',
                        location: 'Jakarta',
                        description: 'Konser musik persahabatan.',
                        image: 'images/event1.webp'
                    },
                    {
                        title: 'Makan2',
                        date: '2025-12-22',
                        location: 'Bandung',
                        description: 'Traktir',
                        image: 'images/event1.webp'
                    }
                ];

                const stmt = db.prepare("INSERT INTO events (title, date, location, description, image) VALUES (?, ?, ?, ?, ?)");
                initialEvents.forEach(evt => {
                    stmt.run(evt.title, evt.date, evt.location, evt.description, evt.image);
                });
                stmt.finalize();
                console.log('[INFO] Membuat beberapa event template');
            }
        });
    });
}

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

    // Routing untuk ambil data event ke db
    if (req.url === '/api/events' && req.method === 'GET') {
        db.all("SELECT * FROM events", [], (err, rows) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(rows));
        });
        return;
    }
    // Routing untuk login
    if (req.url === '/api/login' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { email, password } = JSON.parse(body);

            db.get("SELECT * FROM users WHERE username = ? AND password = ?", [email, password], (err, row) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Server Error' }));
                } else if (row) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
                }
            });
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Bad Request' }));
        }
        return;
    }
    // Routing untuk user daftar ke event
    if (req.url === '/api/register' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const data = JSON.parse(body);
            const date = new Date().toISOString();

            db.run("INSERT INTO registrations (name, email, phone, event_name, date) VALUES (?, ?, ?, ?, ?)",
                [data.name, data.email, data.phone, data.eventName, date],
                function (err) {
                    if (err) {
                        console.error(err.message);
                        res.writeHead(500);
                        res.end(JSON.stringify({ success: false }));
                    } else {
                        console.log(`New Registration ID: ${this.lastID}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }
                }
            );
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false }));
        }
        return;
    }
    // Routing untuk admin buat event
    if (req.url === '/api/events' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const params = new URLSearchParams(body);

            const title = params.get('title');
            const date = params.get('date');
            const location = params.get('location');
            const description = params.get('description');
            const image = 'images/' + params.get('image');

            db.run("INSERT INTO events (title, date, location, description, image) VALUES (?, ?, ?, ?, ?)",
                [title, date, location, description, image],
                function (err) {
                    if (err) {
                        console.error(err.message);
                        res.writeHead(500);
                        res.end('Server Error');
                    } else {
                        console.log(`New Event ID: ${this.lastID}`);
                        // Redirect ke dashboard
                        res.writeHead(302, { 'Location': '/admin-dashboard.html' });
                        res.end();
                    }
                }
            );
        } catch (e) {
            res.writeHead(500);
            res.end('Server Error');
        }
        return;
    }
    // Routing ambil event untuk admin
    if (req.url.startsWith('/api/events/') && req.method === 'GET') {
        const id = req.url.split('/').pop();
        db.get("SELECT * FROM events WHERE id = ?", [id], (err, row) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            } else if (row) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(row));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Event not found' }));
            }
        });
        return;
    }
    // Routing untuk edit event di admin
    if (req.url.startsWith('/api/events/') && req.method === 'PUT') {
        const id = req.url.split('/').pop();
        try {
            const body = await parseBody(req);
            const data = JSON.parse(body);

            db.run(`UPDATE events SET title = ?, date = ?, location = ?, description = ?, image = ? WHERE id = ?`,
                [data.title, data.date, data.location, data.description, data.image, id],
                function (err) {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }
                }
            );
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Bad Request' }));
        }
        return;
    }
    // Routing untuk delete event di admin
    if (req.url.startsWith('/api/events/') && req.method === 'DELETE') {
        const id = req.url.split('/').pop();
        db.run("DELETE FROM events WHERE id = ?", [id], function (err) {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            }
        });
        return;
    }

    // Untuk home (awal)
    let filePath = req.url === '/' ? '/index.html' : req.url;

    // Routing untuk tiap halaman
    if (filePath === '/login') filePath = '/login.html';
    if (filePath === '/register') filePath = '/register-event.html';
    if (filePath === '/create-event') filePath = '/create-event.html';
    if (filePath === '/admin-dashboard') filePath = '/admin-dashboard.html';


    filePath = filePath.split('?')[0];

    let extname = path.extname(filePath);
    let contentType = mimeTypes[extname] || 'application/octet-stream';

    // Anggap html kalo extensionnya kosong
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
    console.log(`[INFO] Server running at http://localhost:${PORT}/`);
});
