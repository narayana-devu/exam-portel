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
const API_VERSION = '7.6.1'; // v76.1: Robustness Fixes (S3 Pagination, Resource Cleanup)

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


app.post('/api/send-whatsapp-old', authMiddleware, (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) {
        return res.status(400).json({ error: 'Phone and message required' });
    }

    const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
    const GUPSHUP_APP_NAME = process.env.GUPSHUP_APP_NAME;

    if (!GUPSHUP_API_KEY || !GUPSHUP_APP_NAME) {
        console.error('Missing Gupshup credentials');
        return res.status(500).json({ error: 'Server configuration error: Missing Gupshup Env Vars' });
    }

    const postData = querystring.stringify({
        channel: 'whatsapp',
        source: GUPSHUP_APP_NAME,
        destination: phone,
        'src.name': GUPSHUP_APP_NAME,
        message: JSON.stringify({
            type: 'text',
            text: message
        })
    });

    const options = {
        hostname: 'api.gupshup.io',
        path: '/sm/api/v1/msg',
        method: 'POST',
        headers: {
            'apikey': GUPSHUP_API_KEY,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const apiReq = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => { data += chunk; });
        apiRes.on('end', () => {
            try {
                const jsonResponse = JSON.parse(data);
                if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                    console.log('✅ WhatsApp Sent:', jsonResponse);
                    res.json({ success: true, data: jsonResponse });
                } else {
                    console.error('❌ Gupshup Error:', jsonResponse);
                    res.status(apiRes.statusCode).json({ error: 'Gupshup API Failed', details: jsonResponse });
                }
            } catch (e) {
                console.error('❌ Gupshup Parse Error:', data);
                res.status(500).json({ error: 'Invalid response from Gupshup' });
            }
        });
    });

    apiReq.on('error', (e) => {
        console.error('❌ WhatsApp Request Error:', e);
        res.status(500).json({ error: e.message });
    });

    apiReq.write(postData);
    apiReq.end();
});

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


// WHATSAPP API PROXY (v54: Added Flexibility & Better Logging)
app.post('/api/send-whatsapp', authMiddleware, async (req, res) => {
    const { phone, message } = req.body;
    const apiKey = process.env.GUPSHUP_API_KEY;
    const appName = process.env.GUPSHUP_APP_NAME || 'exammessage';
    const sourceNumber = process.env.GUPSHUP_SOURCE_PHONE || '917834811114'; // Default to Sandbox
    const apiPath = process.env.GUPSHUP_API_PATH || '/wa/api/v1/msg'; // Default to Sandbox

    if (!apiKey) {
        console.error("WhatsApp Error: Missing GUPSHUP_API_KEY");
        return res.status(500).json({ error: 'Server misconfiguration: Missing API Key' });
    }

    if (!phone || !message) {
        return res.status(400).json({ error: 'Missing phone or message' });
    }

    // Prepare Gupshup Data
    const postData = querystring.stringify({
        'channel': 'whatsapp',
        'source': sourceNumber,
        'destination': phone.replace(/\+/g, '').trim(),
        'message': JSON.stringify({
            'type': 'text',
            'text': message
        }),
        'src.name': appName
    });

    const options = {
        hostname: 'api.gupshup.io',
        port: 443,
        path: apiPath,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'apikey': apiKey,
            'Content-Length': postData.length
        }
    };

    const apiReq = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => data += chunk);
        apiRes.on('end', () => {
            console.log(`[WhatsApp] Gupshup Response Code: ${apiRes.statusCode}`);
            console.log(`[WhatsApp] Gupshup Response Data: ${data}`);

            if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                try {
                    const parsed = JSON.parse(data || '{}');
                    res.json({ success: true, api: apiPath, source: sourceNumber, data: parsed });
                } catch (e) {
                    res.json({ success: true, api: apiPath, source: sourceNumber, raw: data });
                }
            } else {
                console.error(`[WhatsApp] Gupshup API Fail: ${apiRes.statusCode} - ${data}`);
                res.status(apiRes.statusCode).json({
                    error: 'Gupshup API rejected the message',
                    statusCode: apiRes.statusCode,
                    details: data,
                    config: { apiPath, sourceNumber, appName }
                });
            }
        });
    });

    apiReq.on('error', (e) => {
        console.error("[WhatsApp] Request Error:", e);
        res.status(500).json({ error: e.message });
    });

    console.log(`[WhatsApp] Sending to ${phone} via ${apiPath} (Source: ${sourceNumber})...`);
    apiReq.write(postData);
    apiReq.end();
});

// --- STABILITY: AUTO-CLEANUP TASK (v56) ---
// Deletes responses and chunks older than 30 days to save costs
const runCleanup = async () => {
    console.log("[Cleanup] Starting 30-day maintenance task...");
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
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

                        if (timestamp && timestamp < thirtyDaysAgo) {
                            // 1. Find S3 Keys to delete
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

                            // 2. Delete from S3
                            if (s3 && keysToDelete.length > 0) {
                                for (let key of keysToDelete) {
                                    try {
                                        await s3.deleteObject({ Bucket: process.env.BUCKET_NAME, Key: key }).promise();
                                        deletedFiles++;
                                    } catch (e) { console.error(`[Cleanup] S3 Delete Failed: ${key}`, e.message); }
                                }
                            }

                            // 3. Delete from DB
                            await new Promise(res => dbAdapter.delete(tableName, data.id, res));
                            deletedRecords++;
                        }
                    } catch (e) { }
                }
                resolve();
            });
        });
    };

    await processTable('responses');
    await processTable('synced_chunks');

    console.log(`[Cleanup] Completed. Removed ${deletedRecords} records and ${deletedFiles} S3 objects.`);
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

// AI Question Generation Route
app.post('/api/generate-questions-ai', authMiddleware, async (req, res) => {
    try {
        const { qpName, qpCode, pcs, totalQuestions } = req.body;

        if (!genAI) {
            return res.status(400).json({ error: 'AI Generation is disabled. Please add GEMINI_API_KEY to your .env file.' });
        }

        if (!pcs || pcs.length === 0) {
            return res.status(400).json({ error: 'No Performance Criteria provided for generation.' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            You are an expert educational assessor. Generate a "Theory" exam paper for the Qualification Pack: "${qpName}" (Code: ${qpCode}).
            
            TARGET QUESTION COUNT: ${totalQuestions || pcs.length}
            TOTAL PCs TO COVER: ${pcs.length}
            
            PCs AND THEIR TOTAL MARKS:
            ${pcs.map(p => `- PC ID: ${p.id}, Code: ${p.code}, Name: "${p.name}", Marks: ${p.marks}`).join('\n')}
            
            STRICT RULES FOR DISTRIBUTION & COVERAGE:
            1. EVERY SINGLE PC must be covered at least once.
            2. If TARGET QUESTION COUNT > PC COUNT:
               - Distribute the questions across PCs. For example, if there are 5 PCs and you want 10 questions, each PC gets 2 questions.
               - DIVIDE the PC's total marks equally among the questions assigned to it. If PC A has 10 marks and gets 2 questions, each question is 5 marks.
            3. If TARGET QUESTION COUNT < PC COUNT:
               - Group multiple PCs into a single question. 
               - The marks for that question must be the SUM of the marks of all PCs it covers.
            4. If TARGET QUESTION COUNT == PC COUNT:
               - One question per PC. Marks match PC marks exactly.

            OUTPUT REQUIREMENTS:
            - Output MUST be a VALID JSON ARRAY of objects.
            - Each search object:
               - question: Clear, professional theory question (MCQ preferred or Subjective).
               - questionType: "MCQ" or "Subjective".
               - options: Array of 4 strings for MCQ, or [] for Subjective.
               - correctAnswer: Correct option string or model answer.
               - totalMarks: Marks for this specific question (calculated based on the distribution rules above).
               - pcMapping: Object mapping PC IDs to their mark contribution in this question. 
                 Example if covering 2 PCs: { "pc_id_1": 5, "pc_id_2": 5 }. 
                 Example if 1 PC: { "pc_id_1": 10 }.

            Do not include any markdown formatting, preamble, or explanation. ONLY THE JSON ARRAY.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean up markdown if AI includes it
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const questions = JSON.parse(text);
            res.json({ questions });
        } catch (parseError) {
            console.error("[AI] Parse Error:", text);
            res.status(500).json({ error: 'Failed to parse AI response into valid JSON.', raw: text });
        }

    } catch (e) {
        console.error("[AI] Generation Error:", e);
        res.status(500).json({ error: e.message });
    }
});

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
