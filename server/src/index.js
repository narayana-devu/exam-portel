const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const https = require('https');
const querystring = require('querystring');
const sqlite3 = require('sqlite3').verbose();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Manual .env parser (since dotenv is not installed and npm is blocked)
if (fs.existsSync(path.join(__dirname, '../../.env'))) {
    const envConfig = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.join('=').trim();
        }
    });
    console.log('[ENV] Loaded local environment variables');
}

const app = express();
const PORT = process.env.PORT || 5000;
const API_VERSION = '82'; // v82: WhatsApp Integration Removed

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(express.static('uploads'));

// Ensure uploads directory exists (Fallback)
const uploadsDir = path.join(__dirname, '../uploads');
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

// AI CONFIGURATION
let genAI = null;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("[AI] Gemini API Key found. AI Generation enabled.");
} else {
    console.log("[AI] Gemini API Key MISSING. AI Generation disabled.");
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
        console.log(`[S3] Uploading: ${fileName} (${fileContent.length} bytes)`);
        const data = await s3.upload(params).promise();
        return data.Location;
    } catch (e) {
        console.error("S3 Upload Error [CRITICAL]:", e.message);
        if (e.code === 'AccessDenied') {
            console.error("[S3] Access Denied! Check Bucket Policies and Block Public Access settings.");
        }
        return null;
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
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Health & Cloud Diagnostics (v82.1)
app.get('/api/diagnostics', async (req, res) => {
    const status = {
        status: 'online',
        timestamp: new Date().toISOString(),
        adapter: s3 ? 's3' : 'local',
        bucket: process.env.BUCKET_NAME || 'None',
        region: process.env.AWS_REGION || 'eu-north-1',
        s3_connected: false
    };

    if (s3) {
        try {
            await s3.headBucket({ Bucket: process.env.BUCKET_NAME }).promise();
            status.s3_connected = true;
        } catch (e) {
            console.error("[S3] Diagnostics Failed:", e.message);
            status.s3_connected = false;
            status.error = e.message;
        }
    }

    res.json(status);
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
        console.log("V75 DEPLOYMENT ACTIVE - Video Recording Improvements");
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
            (async () => {
                try {
                    let allObjects = [];
                    let continuationToken = null;

                    do {
                        const list = await s3.listObjectsV2({
                            Bucket: process.env.BUCKET_NAME,
                            Prefix: `db/${table}/`,
                            ContinuationToken: continuationToken
                        }).promise();

                        if (list.Contents) {
                            allObjects = allObjects.concat(list.Contents);
                        }
                        continuationToken = list.NextContinuationToken;
                    } while (continuationToken);

                    if (allObjects.length === 0) {
                        // v76: Fallback to legacy single-file read if folder is empty
                        try {
                            const legacyData = await this.s3Read(table);
                            return callback(null, legacyData.map(item => ({ data: JSON.stringify(item) })));
                        } catch (e) {
                            return callback(null, []);
                        }
                    }

                    // Fetch all objects in the folder (Batching to avoid 429/Timeout if too many)
                    const items = [];
                    const batchSize = 20;
                    for (let i = 0; i < allObjects.length; i += batchSize) {
                        const batch = allObjects.slice(i, i + batchSize);
                        const fetchPromises = batch
                            .filter(obj => obj.Key.endsWith('.json'))
                            .map(obj => s3.getObject({ Bucket: process.env.BUCKET_NAME, Key: obj.Key }).promise());

                        const results = await Promise.all(fetchPromises);
                        results.forEach(res => items.push({ data: res.Body.toString('utf-8') }));
                    }

                    callback(null, items);
                } catch (e) {
                    console.error(`[S3-DB] getAll Error (${table}):`, e);
                    callback(e, null);
                }
            })();
        } else if (this.type === 'postgres') {
            this.pool.query(`SELECT data FROM ${table}`, (err, res) => callback(err, res ? res.rows : []));
        } else {
            this.db.all(`SELECT data FROM ${table}`, [], callback);
        }
    }

    upsert(table, id, dataStr, callback) {
        if (this.type === 's3') {
            s3.putObject({
                Bucket: process.env.BUCKET_NAME,
                Key: `db/${table}/${id}.json`,
                Body: dataStr,
                ContentType: 'application/json'
            }).promise()
                .then(() => callback(null))
                .catch(e => {
                    console.error(`[S3-DB] Upsert Error (${table}/${id}):`, e);
                    callback(e);
                });
        } else if (this.type === 'postgres') {
            const query = `INSERT INTO ${table} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
            this.pool.query(query, [id, dataStr], callback);
        } else {
            this.db.run(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`, [id, dataStr], callback);
        }
    }

    delete(table, id, callback) {
        if (this.type === 's3') {
            s3.deleteObject({
                Bucket: process.env.BUCKET_NAME,
                Key: `db/${table}/${id}.json`
            }).promise()
                .then(() => callback(null))
                .catch(e => {
                    console.error(`[S3-DB] Delete Error (${table}/${id}):`, e.message);
                    callback(e);
                });
        } else if (this.type === 'postgres') {
            this.pool.query(`DELETE FROM ${table} WHERE id = $1`, [id], callback);
        } else {
            this.db.run(`DELETE FROM ${table} WHERE id = ?`, [id], callback);
        }
    }

    sync(table, newItems, callback) {
        if (this.type === 's3') {
            (async () => {
                try {
                    // v76: Parallel individual upserts
                    const promises = newItems.map(item =>
                        s3.putObject({
                            Bucket: process.env.BUCKET_NAME,
                            Key: `db/${table}/${item.id}.json`,
                            Body: JSON.stringify(item),
                            ContentType: 'application/json'
                        }).promise()
                    );
                    await Promise.all(promises);
                    callback(null);
                } catch (e) {
                    console.error(`[S3-DB] Sync Error (${table}):`, e);
                    callback(e);
                }
            })();
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

    wipe(table, callback) {
        if (this.type === 's3') {
            (async () => {
                try {
                    let continuationToken = null;
                    do {
                        const list = await s3.listObjectsV2({
                            Bucket: process.env.BUCKET_NAME,
                            Prefix: `db/${table}/`,
                            ContinuationToken: continuationToken
                        }).promise();

                        if (list.Contents && list.Contents.length > 0) {
                            const deleteParams = {
                                Bucket: process.env.BUCKET_NAME,
                                Delete: { Objects: list.Contents.map(obj => ({ Key: obj.Key })) }
                            };
                            await s3.deleteObjects(deleteParams).promise();
                        }
                        continuationToken = list.NextContinuationToken;
                    } while (continuationToken);

                    // Also clear legacy monolithic file if exists
                    await s3.deleteObject({ Bucket: process.env.BUCKET_NAME, Key: `db/${table}.json` }).promise().catch(() => { });
                    callback(null);
                } catch (e) {
                    console.error(`[S3-DB] Wipe Error (${table}):`, e);
                    callback(e);
                }
            })();
        } else if (this.type === 'postgres') {
            this.pool.query(`DELETE FROM ${table}`, (err) => callback(err));
        } else {
            this.db.run(`DELETE FROM ${table}`, [], callback);
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
        version: API_VERSION,
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
        const body = req.body;

        // v19.0.13: STRICT VALIDATION: Reject if no ID
        if (Array.isArray(body)) {
            if (body.some(item => !item || !item.id)) {
                return res.status(400).json({ error: "Invalid Data: One or more items missing ID" });
            }
            dbAdapter.sync(tableName, body, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                io.emit('data-change', { table: tableName, action: 'sync' });
                res.json({ success: true, count: body.length });
            });
        } else {
            const id = body.id;
            if (!id) return res.status(400).json({ error: "Invalid Data: Missing ID" });
            const dataStr = JSON.stringify(body);
            dbAdapter.upsert(tableName, id, dataStr, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                io.emit('data-change', { table: tableName, action: 'update', id: id });
                res.json({ success: true, id: id });
            });
        }
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

    // WIPE (Clear Table)
    app.delete(`/api/wipe/${routeName}`, (req, res) => {
        dbAdapter.wipe(tableName, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            io.emit('data-change', { table: tableName, action: 'wipe' });
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
        if (tableName === 'responses') {
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
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit for continuous videos (v19.0.17)
});

// --- S3 PRESIGNED URL (For Large Videos v19.0.18) ---
app.get('/api/presigned-url', authMiddleware, async (req, res) => {
    if (!s3) return res.status(503).json({ error: 'S3 not configured' });
    const { fileName, contentType } = req.query;
    if (!fileName) return res.status(400).json({ error: 'fileName is required' });

    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileName,
        Expires: 3600, // 1 hour
        ContentType: contentType || 'application/octet-stream'
    };

    try {
        const url = await s3.getSignedUrlPromise('putObject', params);
        res.json({ uploadUrl: url, fileKey: fileName });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/upload-media', authMiddleware, upload.single('file'), async (req, res) => {
    // ... (existing code remains SAME)
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    if (!s3) return res.status(503).json({ error: 'S3 storage not configured' });

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
        const s3Url = await uploadToS3(fileName, req.file.buffer, contentType);

        if (s3Url) res.json({ success: true, url: s3Url });
        else throw new Error('S3 upload failed');
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// WHATSAPP API REMOVED - v82

// DELETE MEDIA FROM S3
app.delete('/api/media', authMiddleware, async (req, res) => {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'Key required' });
    if (!s3) return res.status(503).json({ error: 'S3 not configured' });

    try {
        console.log(`[S3] Deleting object: ${key}`);
        await s3.deleteObject({
            Bucket: process.env.BUCKET_NAME,
            Key: key
        }).promise();
        res.json({ success: true });
    } catch (e) {
        console.error("S3 Delete Error:", e);
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
// Supports HTTP Range Requests (HTTP 206) required by Safari/Chrome for video streaming & seeking
app.get('/api/media-stream', async (req, res) => {
    const key = req.query.key;
    const clientKey = req.query.apiKey;

    // 1. Security Check
    if (clientKey !== API_KEY) {
        return res.status(403).send('Unauthorized');
    }

    if (!s3 || !key) {
        return res.status(400).send('Bad Request: Missing S3 config or Key');
    }

    // Determine Content-Type based on extension
    const ext = path.extname(key).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (['.png'].includes(ext)) contentType = 'image/png';
    else if (['.webm'].includes(ext)) contentType = 'video/webm';
    else if (['.mp4'].includes(ext)) contentType = 'video/mp4';

    try {
        // Fetch metadata to get the total content size of the file in S3
        const metadata = await s3.headObject({
            Bucket: process.env.BUCKET_NAME,
            Key: key
        }).promise();

        const totalSize = metadata.ContentLength;
        const range = req.headers.range;

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', contentType);

        if (range) {
            // Parse Range Header, e.g. "bytes=0-1048576"
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

            // Check if range is valid
            if (start >= totalSize || end >= totalSize || start > end) {
                res.setHeader('Content-Range', `bytes */${totalSize}`);
                return res.status(416).send('Requested Range Not Satisfiable');
            }

            const chunksize = (end - start) + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
            res.setHeader('Content-Length', chunksize);

            const streamParams = {
                Bucket: process.env.BUCKET_NAME,
                Key: key,
                Range: `bytes=${start}-${end}`
            };

            s3.getObject(streamParams).createReadStream()
                .on('error', (err) => {
                    console.error("Stream Range Error:", err.code, key);
                    if (!res.headersSent) {
                        res.status(500).send(err.message);
                    }
                })
                .pipe(res);
        } else {
            // No range header provided, send the full file content
            res.setHeader('Content-Length', totalSize);
            s3.getObject({
                Bucket: process.env.BUCKET_NAME,
                Key: key
            }).createReadStream()
                .on('error', (err) => {
                    console.error("Stream Full Error:", err.code, key);
                    if (!res.headersSent) {
                        if (err.code === 'NoSuchKey') res.status(404).send('Not Found');
                        else res.status(500).send(err.message);
                    }
                })
                .pipe(res);
        }
    } catch (e) {
        console.error("S3 Proxy Error:", e.message, key);
        if (!res.headersSent) {
            if (e.code === 'NotFound' || e.code === 'NoSuchKey') {
                res.status(404).send('Not Found');
            } else {
                res.status(500).send(e.message);
            }
        }
    }
});
// createCRUDEndpoints('synced_chunks', 'synced_chunks'); // Replaced by custom handler above

// Removed duplicate health check from bottom


// WHATSAPP API PROXY REMOVED - v82
app.post('/api/send-whatsapp', authMiddleware, async (req, res) => {
    res.status(410).json({ error: 'WhatsApp feature has been permanently disabled (v82).' });
});

// --- STABILITY: AUTO-CLEANUP TASK (v87 - Split Retention Policy) ---
// Videos deleted after 7 days (cost saving), exam records kept 30 days
const runCleanup = async () => {
    console.log("[Cleanup] Starting maintenance task (v87)...");
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo  = Date.now() - (7  * 24 * 60 * 60 * 1000);
    let deletedFiles = 0;
    let deletedRecords = 0;

    const processTable = async (tableName) => {
        return new Promise((resolve) => {
            dbAdapter.getAll(tableName, async (err, rows) => {
                if (err || !rows) return resolve();

                for (let row of rows) {
                    try {
                        const data = JSON.parse(row.data);
                        const timestamp = data.timestamp || data.uploadedAt || (data.id && !isNaN(data.id.split('_')[1]) ? parseInt(data.id.split('_')[1]) : null);

                        if (!timestamp) continue;

                        // --- VIDEO FILES: Delete from S3 after 7 days ---
                        if (timestamp < sevenDaysAgo && data.evidence && Array.isArray(data.evidence)) {
                            const videoEvidence = data.evidence.filter(ev =>
                                ev.type === 'MANDATORY_VIDEO_REC' || (ev.url && (ev.url.includes('.webm') || ev.url.includes('.mp4')))
                            );
                            for (const ev of videoEvidence) {
                                if (s3 && ev.url && ev.url.includes(process.env.BUCKET_NAME)) {
                                    try {
                                        const urlObj = new URL(ev.url);
                                        const key = decodeURIComponent(urlObj.pathname.substring(1));
                                        await s3.deleteObject({ Bucket: process.env.BUCKET_NAME, Key: key }).promise();
                                        console.log(`[Cleanup] Deleted 7-day-old video: ${key}`);
                                        deletedFiles++;
                                        // Mark as deleted in record (keep the record, remove the URL)
                                        ev.url = null;
                                        ev.deleted = true;
                                        ev.deletedAt = new Date().toISOString();
                                    } catch (e) { console.error(`[Cleanup] Video S3 Delete Failed:`, e.message); }
                                }
                            }
                            // Update the record with video URLs nulled
                            await new Promise(res => dbAdapter.upsert(tableName, data.id, JSON.stringify(data), res));
                        }

                        // --- OLD RECORDS: Delete everything after 30 days ---
                        if (timestamp < thirtyDaysAgo) {
                            const keysToDelete = [];
                            if (data.evidence && Array.isArray(data.evidence)) {
                                data.evidence.forEach(ev => {
                                    if (ev.url && ev.url.includes(process.env.BUCKET_NAME)) {
                                        try {
                                            const urlObj = new URL(ev.url);
                                            keysToDelete.push(decodeURIComponent(urlObj.pathname.substring(1)));
                                        } catch (e) { }
                                    } else if (ev.storage === 's3' && ev.img) {
                                        keysToDelete.push(ev.img);
                                    }
                                });
                            }
                            if (data.storage === 's3' && data.data && typeof data.data === 'string' && data.data.startsWith('http')) {
                                try {
                                    const urlObj = new URL(data.data);
                                    keysToDelete.push(decodeURIComponent(urlObj.pathname.substring(1)));
                                } catch (e) { }
                            }
                            if (s3 && keysToDelete.length > 0) {
                                for (let key of keysToDelete) {
                                    try {
                                        await s3.deleteObject({ Bucket: process.env.BUCKET_NAME, Key: key }).promise();
                                        deletedFiles++;
                                    } catch (e) { console.error(`[Cleanup] S3 Delete Failed: ${key}`, e.message); }
                                }
                            }
                            await new Promise(res => dbAdapter.delete(tableName, data.id, res));
                            deletedRecords++;
                        }

                    } catch (e) { console.error('[Cleanup] Row Error:', e.message); }
                }
                resolve();
            });
        });
    };

    await processTable('responses');
    await processTable('synced_chunks');

    console.log(`[Cleanup] Done. Deleted ${deletedRecords} records + ${deletedFiles} S3 files.`);
    return { deletedRecords, deletedFiles };
};

// Manual Cleanup Trigger (Admin Only)
app.post('/api/system/cleanup', authMiddleware, async (req, res) => {
    try {
        const result = await runCleanup();
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Schedule cleanup every 24 hours
setInterval(runCleanup, 24 * 60 * 60 * 1000);
// Run once on startup after a short delay
setTimeout(runCleanup, 10000);


// Serve Client Static Files
app.use(express.static(path.join(__dirname, '../../client')));

// Catch-all to serve index.html for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/index.html'));
});

// Use httpServer.listen instead of app.listen
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
