const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(express.static('uploads'));

// Ensure uploads directory exists (Fallback)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// S3 CONFIGURATION
const AWS = require('aws-sdk');
let s3 = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.BUCKET_NAME) {
    AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'ap-south-1' // Default region
    });
    s3 = new AWS.S3();
    console.log("S3 Enabled: " + process.env.BUCKET_NAME);
} else {
    console.log("S3 Disabled (Missing valid AWS Env Vars). Using Local Disk.");
}

const uploadToS3 = async (fileName, fileContent, contentType = 'application/octet-stream') => {
    if (!s3) return null;
    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileName,
        Body: fileContent,
        // ACL: 'public-read', // Removed to avoid 500 errors if Block Public Access is ON
        ContentType: contentType
    };
    try {
        const data = await s3.upload(params).promise();
        return data.Location;
    } catch (e) {
        console.error("S3 Upload Error [CRITICAL]:", e.message);
        return null; // The endpoint will handle the null
    }
};

// Create HTTP Server & Socket.io
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for dev
        methods: ["GET", "POST"]
    }
});

// PRODUCTION SECURITY: API Key Middleware
const API_KEY = process.env.API_KEY || 'portel_secure_key_2025';
const authMiddleware = (req, res, next) => {
    // Check Header (Standard API) OR Query Param (Media Proxy)
    const clientKey = req.headers['x-api-key'] || req.query.apiKey;

    if (clientKey && clientKey === API_KEY) {
        next();
    } else {
        res.status(403).json({ error: 'Unauthorized: Invalid API Key' });
    }
};

// Public Health Check (Must be before Auth Middleware)
// Public Health Check (Must be before Auth Middleware)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Apply Auth to API Routes
app.use('/api', authMiddleware);

// --- SIGNALING SERVER LOGIC ---
const peers = {}; // tracking peers in rooms

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // Join a Meeting Room (based on Batch ID)
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        console.log(`User ${userId} joined room ${roomId}`);

        // Notify others in room
        socket.to(roomId).emit('user-connected', userId);

        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected`);
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });

    // Forward WebRTC Signals (Offer, Answer, ICE Candidate)
    socket.on('signal', (data) => {
        // data: { target: 'socket/user id', signal: ... }
        // Broadcast to the room (or specific target if we had mapping)
        // For simple 1-on-1, broadcast to room mostly works or use room
        const { roomId, signal } = data;
        socket.to(roomId).emit('signal', { sender: socket.id, signal });
    });
});

// --- DATABASE ADAPTER PATTERN ---
// --- DATABASE ADAPTER PATTERN (S3 EDITION) ---
class DatabaseAdapter {
    constructor() {
        this.useS3 = !!s3; // Global s3 object defined above
        this.type = this.useS3 ? 's3' : (process.env.DATABASE_URL ? 'postgres' : 'sqlite');

        console.log("========================================");
        console.log("V17.8 DEPLOYMENT ACTIVE - CLOUD_FORCE_BACKUP");
        console.log(`DATABASE ADAPTER: ${this.type.toUpperCase()}`);
        console.log("========================================");

        // Keep Postgres/SQLite as fallbacks or for specific setups
        if (this.type === 'postgres') {
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
        } else if (this.type === 'sqlite') {
            this.db = new sqlite3.Database('./database.sqlite');
        }
    }

    init() {
        // S3 doesn't need table init (schema-less)
        if (this.type === 's3') return;

        // Legacy Init
        const tables = ["batches", "students", "qps", "nos", "pcs", "responses", "ssc", "question_papers", "synced_chunks", "assessors"];
        const schema = {
            postgres: (table) => `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT)`,
            sqlite: (table) => `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT)`
        };
        tables.forEach(table => {
            if (this.type === 'postgres') this.pool.query(schema.postgres(table)).catch(e => console.error(e));
            else if (this.type === 'sqlite') this.db.run(schema.sqlite(table));
        });
    }

    // --- S3 HELPERS ---
    async s3Read(table) {
        try {
            const data = await s3.getObject({ Bucket: process.env.BUCKET_NAME, Key: `db/${table}.json` }).promise();
            return JSON.parse(data.Body.toString('utf-8'));
        } catch (e) {
            if (e.code === 'NoSuchKey') return []; // Empty table
            throw e;
        }
    }

    async s3Write(table, data) {
        await s3.putObject({
            Bucket: process.env.BUCKET_NAME,
            Key: `db/${table}.json`,
            Body: JSON.stringify(data),
            ContentType: 'application/json',
            // ACL: 'public-read' // REMOVED: Blocks write if bucket doesn't allow public ACLs. Data is safer private.
        }).promise();
    }

    // --- CRUD ---

    getAll(table, callback) {
        if (this.type === 's3') {
            this.s3Read(table)
                .then(items => callback(null, items.map(item => ({ data: JSON.stringify(item) })))) // mimic DB row format {data: ...}
                .catch(err => callback(err, null));
        } else if (this.type === 'postgres') {
            this.pool.query(`SELECT data FROM ${table}`, (err, res) => callback(err, res ? res.rows : []));
        } else {
            this.db.all(`SELECT data FROM ${table}`, [], callback);
        }
    }

    upsert(table, id, dataStr, callback) {
        const item = JSON.parse(dataStr);
        if (this.type === 's3') {
            this.s3Read(table).then(items => {
                const idx = items.findIndex(i => i.id === id);
                if (idx >= 0) items[idx] = item;
                else items.push(item);
                return this.s3Write(table, items);
            }).then(() => callback(null)).catch(e => callback(e));
        } else if (this.type === 'postgres') {
            const query = `INSERT INTO ${table} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
            this.pool.query(query, [id, dataStr], callback);
        } else {
            this.db.run(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`, [id, dataStr], callback);
        }
    }

    delete(table, id, callback) {
        if (this.type === 's3') {
            this.s3Read(table).then(items => {
                const newItems = items.filter(i => i.id !== id);
                return this.s3Write(table, newItems);
            }).then(() => callback(null)).catch(e => callback(e));
        } else if (this.type === 'postgres') {
            this.pool.query(`DELETE FROM ${table} WHERE id = $1`, [id], callback);
        } else {
            this.db.run(`DELETE FROM ${table} WHERE id = ?`, [id], callback);
        }
    }

    sync(table, newItems, callback) {
        if (this.type === 's3') {
            this.s3Read(table).then(existingItems => {
                // Upsert Logic (Merge)
                newItems.forEach(newItem => {
                    const idx = existingItems.findIndex(i => i.id === newItem.id);
                    if (idx >= 0) existingItems[idx] = newItem;
                    else existingItems.push(newItem);
                });
                return this.s3Write(table, existingItems);
            }).then(() => callback(null)).catch(e => callback(e));
        } else if (this.type === 'postgres') {
            // (Keep existing Postgres Sync Logic)
            (async () => {
                const client = await this.pool.connect();
                try {
                    await client.query('BEGIN');
                    const query = `INSERT INTO ${table} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
                    for (const item of newItems) await client.query(query, [item.id, JSON.stringify(item)]);
                    await client.query('COMMIT');
                    callback(null);
                } catch (e) { await client.query('ROLLBACK'); callback(e); } finally { client.release(); }
            })();
        } else {
            this.db.serialize(() => {
                const stmt = this.db.prepare(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`);
                newItems.forEach(item => stmt.run(item.id, JSON.stringify(item)));
                stmt.finalize(callback);
            });
        }
    }
}

// Initialize Adapter
const dbAdapter = new DatabaseAdapter();
dbAdapter.init();

// Diagnostics Route (Public or Protected?)
// Let's protect it with the same auth to avoid leaking bucket name to public.
app.get('/api/diagnostics', authMiddleware, (req, res) => {
    res.json({
        version: 'v18.0',
        storage_type: dbAdapter.type,
        s3_enabled: !!s3,
        bucket_name: process.env.BUCKET_NAME || 'Not Set',
        region: process.env.AWS_REGION || 'ap-south-1',
        database_url_present: !!process.env.DATABASE_URL,
        time: new Date().toISOString()
    });
});

// --- API ROUTES ---

// Helper for simple CRUD
function createCRUDEndpoints(tableName, routeName) {
    // GET ALL
    app.get(`/api/${routeName}`, (req, res) => {
        dbAdapter.getAll(tableName, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const items = rows.map(r => JSON.parse(r.data));
            res.json(items);
        });
    });

    // POST (Create/Update)
    app.post(`/api/${routeName}`, (req, res) => {
        const item = req.body;
        const id = item.id;
        const dataStr = JSON.stringify(item);

        dbAdapter.upsert(tableName, id, dataStr, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            io.emit('data-change', { table: tableName, action: 'update', id: id });
            res.json({ success: true, id: id });
        });
    });

    // DELETE
    app.delete(`/api/${routeName}/:id`, (req, res) => {
        const id = req.params.id;
        dbAdapter.delete(tableName, id, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            io.emit('data-change', { table: tableName, action: 'delete', id: id });
            res.json({ success: true });
        });
    });

    // SYNC (Replace All)
    app.post(`/api/sync/${routeName}`, (req, res) => {
        const items = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: "Expected array" });

        const performSync = (finalItems) => {
            dbAdapter.sync(tableName, finalItems, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                io.emit('data-change', { table: tableName, action: 'sync' });
                res.json({ success: true, count: finalItems.length });
            });
        };

        // SMART MERGE FOR RESPONSES (Prevent URL Data Loss from Stale Admins)
        if (tableName === 'se_responses') {
            dbAdapter.getAll(tableName, (err, rows) => {
                if (!err && rows) {
                    const existingMap = new Map();
                    rows.forEach(r => {
                        try {
                            const d = JSON.parse(r.data);
                            existingMap.set(d.id, d);
                        } catch (e) { }
                    });

                    items.forEach(newItem => {
                        const oldItem = existingMap.get(newItem.id);
                        if (oldItem && oldItem.evidence && newItem.evidence) {
                            newItem.evidence.forEach(newEv => {
                                // Restore URL if missing in new but present in old
                                const key = newEv.key || newEv.img;
                                if ((!newEv.url || newEv.url === "") && key) {
                                    const oldEv = oldItem.evidence.find(e => (e.key === key || e.img === key));
                                    if (oldEv && oldEv.url) {
                                        // console.log(`[SmartMerge] Restoring URL for ${key}`);
                                        newEv.url = oldEv.url;
                                        newEv.uploaded = true;
                                        newEv.storage = 's3';
                                    }
                                }
                            });
                        }
                    });
                }
                performSync(items);
            });
            return;
        }

        performSync(items);
    });
}

// Create Routes for Known Tables
const TABLES = ["batches", "students", "qps", "nos", "pcs", "responses", "ssc", "question_papers", "synced_chunks", "assessors"];
const ROUTES = ["batches", "students", "qps", "nos", "pcs", "responses", "ssc", "question_papers", "synced_chunks", "assessors"];

TABLES.forEach((table, idx) => createCRUDEndpoints(table, ROUTES[idx]));

// --- MEDIA UPLOAD ENDPOINT (S3) ---
const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit per chunk
});

app.post('/api/upload-media', authMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
    }

    if (!s3) {
        // Fallback to local disk (optional, or just error)
        return res.status(503).json({ error: 'S3 storage not configured' });
    }

    try {
        const ext = path.extname(req.file.originalname).toLowerCase();
        let folder = 'media/others';
        let contentType = req.file.mimetype || 'application/octet-stream';

        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            folder = 'media/photos';
            contentType = 'image/jpeg';
        } else if (['.webm', '.mp4'].includes(ext)) {
            folder = 'media/videos';
            contentType = 'video/webm';
        }

        const fileName = `${folder}/${Date.now()}_${req.file.originalname}`;
        console.log(`[S3] Uploading to: ${fileName} (${contentType})`);

        const s3Url = await uploadToS3(fileName, req.file.buffer, contentType);

        if (s3Url) {
            console.log(`[S3] Success: ${s3Url}`);
            res.json({ success: true, url: s3Url });
        } else {
            throw new Error('S3 upload failed (Check server logs for detail)');
        }
    } catch (e) {
        console.error("Media Upload Error", e);
        res.status(500).json({ error: e.message });
    }
});

// CUSTOM HANDLER FOR CHUNKS (S3 Support)
app.post('/api/synced_chunks', async (req, res) => {
    // 1. Check if S3 is active
    if (s3) {
        // Assume req.body is { id, data: "base64...", ... }
        // Or if it is a bulk sync array
        let items = Array.isArray(req.body) ? req.body : [req.body];

        try {
            for (let item of items) {
                if (item.data) {
                    // Upload Base64 to S3
                    const buffer = Buffer.from(item.data, 'base64');
                    const key = `chunks/${item.id}_${Date.now()}.bin`;
                    const s3Url = await uploadToS3(key, buffer);

                    if (s3Url) {
                        item.data = s3Url; // Replace heavy data with URL
                        item.storage = 's3';
                    }
                }
                // Save Metadata to DB (Postgres)
                await new Promise((resolve, reject) => {
                    dbAdapter.upsert('synced_chunks', item.id, JSON.stringify(item), (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
            res.json({ success: true, count: items.length, storage: 's3_hybrid' });
        } catch (e) {
            console.error("S3 Sync Error", e);
            res.status(500).json({ error: e.message });
        }
    } else {
        // Fallback to non-S3 logic (save to local DB)
        const fallbackItems = Array.isArray(req.body) ? req.body : [req.body];
        dbAdapter.sync('synced_chunks', fallbackItems, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, count: fallbackItems.length });
        });
    }
});

// SECURE MEDIA PROXY (Streams S3 Content via Server Credentials)
app.get('/api/media-stream', (req, res) => {
    const key = req.query.key;
    const clientKey = req.query.apiKey;

    // 1. Security Check
    if (clientKey !== API_KEY) {
        return res.status(403).send('Unauthorized');
    }

    if (!s3 || !key) {
        return res.status(400).send('Bad Request: Missing S3 config or Key');
    }

    // 2. Stream from S3
    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: key
    };

    // Optional: Set Content-Type based on extension
    const ext = path.extname(key).toLowerCase();
    if (['.jpg', '.jpeg'].includes(ext)) res.setHeader('Content-Type', 'image/jpeg');
    if (['.png'].includes(ext)) res.setHeader('Content-Type', 'image/png');
    if (['.webm'].includes(ext)) res.setHeader('Content-Type', 'video/webm');
    if (['.mp4'].includes(ext)) res.setHeader('Content-Type', 'video/mp4');

    s3.getObject(params)
        .createReadStream()
        .on('error', (err) => {
            console.error("Stream Error:", err.code, key);
            if (err.code === 'NoSuchKey') res.status(404).send('Not Found');
            else res.status(500).send(err.message);
        })
        .pipe(res);
});
// createCRUDEndpoints('synced_chunks', 'synced_chunks'); // Replaced by custom handler above

// Removed duplicate health check from bottom

// Serve Client Static Files
app.use(express.static(path.join(__dirname, '../client')));

// Catch-all to serve index.html for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Use httpServer.listen instead of app.listen
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
