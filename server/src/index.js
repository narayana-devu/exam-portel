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
const PDFDocument = require('pdfkit');

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
                
                // v87.0: Auto trigger Google Drive Sync on Batch creation/update
                if (tableName === 'batches') {
                    body.forEach(b => {
                        if (b && b.id) {
                            gdriveSyncs[b.id] = {
                                status: 'syncing',
                                progress: 'Starting background job (Auto-Sync)...',
                                completed: 0,
                                total: 0,
                                error: null
                            };
                            runGDriveSync(b.id, b.name);
                        }
                    });
                }

                // Auto trigger Google Drive Sync when students are uploaded
                if (tableName === 'students') {
                    const affectedBatchIds = [...new Set(body.map(s => s.batchId).filter(Boolean))];
                    affectedBatchIds.forEach(bId => {
                        dbAdapter.getAll('batches', (err2, batchRows) => {
                            if (err2) return;
                            const batches = batchRows.map(r => { try { return JSON.parse(r.data); } catch(e) { return null; } }).filter(Boolean);
                            const batch = batches.find(b => b.id === bId);
                            if (batch) {
                                gdriveSyncs[bId] = {
                                    status: 'syncing',
                                    progress: 'Auto-syncing after student upload...',
                                    completed: 0,
                                    total: 0,
                                    error: null
                                };
                                runGDriveSync(bId, batch.name);
                            }
                        });
                    });
                }

                // Auto trigger Google Drive Sync when responses are uploaded (v87.1)
                if (tableName === 'responses') {
                    triggerGDriveSyncForResponses(body);
                }
                
                res.json({ success: true, count: body.length });
            });
        } else {
            const id = body.id;
            if (!id) return res.status(400).json({ error: "Invalid Data: Missing ID" });
            const dataStr = JSON.stringify(body);
            dbAdapter.upsert(tableName, id, dataStr, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                io.emit('data-change', { table: tableName, action: 'update', id: id });

                // v87.0: Auto trigger Google Drive Sync on Batch creation/update
                if (tableName === 'batches') {
                    gdriveSyncs[id] = {
                        status: 'syncing',
                        progress: 'Starting background job (Auto-Sync)...',
                        completed: 0,
                        total: 0,
                        error: null
                    };
                    runGDriveSync(id, body.name);
                }

                // Auto trigger Google Drive Sync when a single student is saved
                if (tableName === 'students' && body.batchId) {
                    dbAdapter.getAll('batches', (err2, batchRows) => {
                        if (err2) return;
                        const batches = batchRows.map(r => { try { return JSON.parse(r.data); } catch(e) { return null; } }).filter(Boolean);
                        const batch = batches.find(b => b.id === body.batchId);
                        if (batch) {
                            gdriveSyncs[body.batchId] = {
                                status: 'syncing',
                                progress: 'Auto-syncing after student save...',
                                completed: 0,
                                total: 0,
                                error: null
                            };
                            runGDriveSync(body.batchId, batch.name);
                        }
                    });
                }

                // Auto trigger Google Drive Sync when a single response is saved (v87.1)
                if (tableName === 'responses') {
                    triggerGDriveSyncForResponses([body]);
                }

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

                // v87.0: Auto trigger Google Drive Sync on Batch sync
                if (tableName === 'batches') {
                    finalItems.forEach(b => {
                        if (b && b.id) {
                            gdriveSyncs[b.id] = {
                                status: 'syncing',
                                progress: 'Starting background job (Auto-Sync)...',
                                completed: 0,
                                total: 0,
                                error: null
                            };
                            runGDriveSync(b.id, b.name);
                        }
                    });
                }

                // Auto trigger Google Drive Sync when students are bulk-synced
                if (tableName === 'students') {
                    const affectedBatchIds = [...new Set(finalItems.map(s => s.batchId).filter(Boolean))];
                    affectedBatchIds.forEach(bId => {
                        dbAdapter.getAll('batches', (err2, batchRows) => {
                            if (err2) return;
                            const batches = batchRows.map(r => { try { return JSON.parse(r.data); } catch(e) { return null; } }).filter(Boolean);
                            const batch = batches.find(b => b.id === bId);
                            if (batch) {
                                gdriveSyncs[bId] = {
                                    status: 'syncing',
                                    progress: 'Auto-syncing after student bulk-sync...',
                                    completed: 0,
                                    total: 0,
                                    error: null
                                };
                                runGDriveSync(bId, batch.name);
                            }
                        });
                    });
                }

                // Auto trigger Google Drive Sync when responses are bulk-synced (v87.1)
                if (tableName === 'responses') {
                    triggerGDriveSyncForResponses(finalItems);
                }

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
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

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

        const baseFileName = `${Date.now()}_${req.file.originalname}`;
        const relativeFileName = `${folder}/${baseFileName}`;

        if (s3) {
            const s3Url = await uploadToS3(relativeFileName, req.file.buffer, contentType);
            if (s3Url) {
                res.json({ success: true, url: s3Url });
            } else {
                throw new Error('S3 upload failed');
            }
        } else {
            // Local fallback (v87.1)
            const localFolderDir = path.join(uploadsDir, folder);
            if (!fs.existsSync(localFolderDir)) {
                fs.mkdirSync(localFolderDir, { recursive: true });
            }
            const localFilePath = path.join(localFolderDir, baseFileName);
            fs.writeFileSync(localFilePath, req.file.buffer);

            const protocol = req.protocol;
            const host = req.get('host');
            const localUrl = `${protocol}://${host}/${folder}/${baseFileName}`;
            console.log(`[Local Upload] Saved file locally: ${localFilePath} -> ${localUrl}`);
            res.json({ success: true, url: localUrl });
        }
    } catch (e) {
        console.error("Upload Media Error:", e.message);
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


// ── GOOGLE DRIVE SYNC INTEGRATION (v86.9.5) ───────────────────────────
const crypto = require('crypto');

// Get Google credentials from environment variable or local fallback
function getGoogleCredentials() {
    if (process.env.GOOGLE_CREDENTIALS) {
        try {
            return JSON.parse(process.env.GOOGLE_CREDENTIALS);
        } catch (e) {
            console.error("[GDrive-Sync] Failed to parse GOOGLE_CREDENTIALS environment variable:", e.message);
        }
    }
    const googleCredentialsPath = path.join(__dirname, '../google-credentials.json');
    if (fs.existsSync(googleCredentialsPath)) {
        try {
            return JSON.parse(fs.readFileSync(googleCredentialsPath, 'utf8'));
        } catch (e) {
            console.error("[GDrive-Sync] Failed to parse google-credentials.json:", e.message);
        }
    }
    return null;
}

// Get Google OAuth 2.0 Credentials from environment variable or local fallback
function getGoogleOAuthCredentials() {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
        return {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        };
    }
    const googleOAuthPath = path.join(__dirname, '../google-oauth-credentials.json');
    if (fs.existsSync(googleOAuthPath)) {
        try {
            return JSON.parse(fs.readFileSync(googleOAuthPath, 'utf8'));
        } catch (e) {
            console.error("[GDrive-Sync] Failed to parse google-oauth-credentials.json:", e.message);
        }
    }
    return null;
}

// Helper to get Google Drive Access Token using Service Account credentials
async function getGoogleAccessToken(creds) {
    const header = JSON.stringify({ alg: 'RS256', typ: 'JWT' });
    const claim = JSON.stringify({
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/drive',
        aud: creds.token_uri,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
    });

    const base64UrlEncode = (str) => {
        return Buffer.from(str)
            .toString('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    };

    const tokenInput = `${base64UrlEncode(header)}.${base64UrlEncode(claim)}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(tokenInput);
    const signature = sign.sign(creds.private_key, 'base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const jwt = `${tokenInput}.${signature}`;

    return new Promise((resolve, reject) => {
        const postData = querystring.stringify({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        });

        const req = https.request(creds.token_uri, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.access_token) {
                        resolve(parsed.access_token);
                    } else {
                        reject(new Error('Failed to get access token: ' + JSON.stringify(parsed)));
                    }
                } catch (e) { reject(e); }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Helper to get Google Drive Access Token using OAuth 2.0 Refresh Token
async function getGoogleAccessTokenForOAuth(creds) {
    return new Promise((resolve, reject) => {
        const postData = querystring.stringify({
            client_id: creds.client_id,
            client_secret: creds.client_secret,
            refresh_token: creds.refresh_token,
            grant_type: 'refresh_token'
        });

        const req = https.request('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.access_token) {
                        resolve(parsed.access_token);
                    } else {
                        reject(new Error('Failed to exchange refresh token: ' + JSON.stringify(parsed)));
                    }
                } catch (e) { reject(e); }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Google Drive API helper: Create Folder
async function createGDriveFolder(accessToken, name, parentId = null) {
    return new Promise((resolve, reject) => {
        const metadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder'
        };
        if (parentId) metadata.parents = [parentId];

        const body = JSON.stringify(metadata);
        const req = https.request('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.id) resolve(parsed.id);
                    else reject(new Error(`Folder create failed: ${data}`));
                } catch (e) { reject(e); }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Google Drive API helper: Find Folder
async function findGDriveFolder(accessToken, name, parentId = null) {
    return new Promise((resolve, reject) => {
        let query = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        if (parentId) query += ` and '${parentId}' in parents`;

        const pathQuery = `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        const req = https.request(`https://www.googleapis.com${pathQuery}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.files && parsed.files.length > 0) resolve(parsed.files[0].id);
                    else resolve(null);
                } catch (e) { reject(e); }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Google Drive API helper: Find File
async function findGDriveFile(accessToken, name, parentId) {
    return new Promise((resolve, reject) => {
        const query = `name = '${name.replace(/'/g, "\\'")}'  and '${parentId}' in parents and trashed = false`;
        const pathQuery = `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        const req = https.request(`https://www.googleapis.com${pathQuery}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.files && parsed.files.length > 0) resolve(parsed.files[0].id);
                    else resolve(null);
                } catch (e) { reject(e); }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Google Drive API helper: Delete File by ID
async function deleteGDriveFile(accessToken, fileId) {
    return new Promise((resolve, reject) => {
        const req = https.request(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }, (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve(true));
        });
        req.on('error', reject);
        req.end();
    });
}

// Google Drive API helper: Upload File (Resumable)
async function uploadGDriveFile(accessToken, name, mimeType, parentId, buffer) {
    return new Promise((resolve, reject) => {
        const metadata = JSON.stringify({
            name: name,
            parents: [parentId]
        });

        // 1. Initiate Session
        const req = https.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': mimeType,
                'Content-Length': Buffer.byteLength(metadata)
            }
        }, (res) => {
            const location = res.headers.location;
            if (!location) {
                reject(new Error(`Failed to initiate resumable upload session. Status: ${res.statusCode}`));
                return;
            }

            // 2. Upload Content
            const uploadUrl = new URL(location);
            const uploadReq = https.request({
                hostname: uploadUrl.hostname,
                path: uploadUrl.pathname + uploadUrl.search,
                method: 'PUT',
                headers: {
                    'Content-Type': mimeType,
                    'Content-Length': buffer.length
                }
            }, (uploadRes) => {
                let data = '';
                uploadRes.on('data', chunk => data += chunk);
                uploadRes.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.id) resolve(parsed.id);
                        else reject(new Error(`Upload failed: ${data}`));
                    } catch (e) {
                        reject(new Error(`Upload finished, response parse failed. Status: ${uploadRes.statusCode}`));
                    }
                });
            });

            uploadReq.on('error', reject);
            uploadReq.write(buffer);
            uploadReq.end();
        });

        req.on('error', reject);
        req.write(metadata);
        req.end();
    });
}

// Sync logging helper
const logPath = path.join(__dirname, '../sync.log');
const syncLog = (msg) => {
    try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) {
        console.error("Failed to write to sync.log:", e.message);
    }
};

// Fetch evidence file as raw buffer (support S3, proxy, local)
const getEvidenceBuffer = async (item) => {
    let url = item.url || item.img || item.downloadUrl;
    if (!url) {
        syncLog("[getEvidenceBuffer] Empty URL in item: " + JSON.stringify(item));
        return null;
    }

    syncLog("[getEvidenceBuffer] Fetching URL: " + url);

    if (url.startsWith('data:')) {
        syncLog("[getEvidenceBuffer] Detected Data URL.");
        const matches = url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            return Buffer.from(matches[2], 'base64');
        }
    }

    // 1. Direct local file resolution from URL path (v87.1)
    try {
        if (url.startsWith('http')) {
            const urlObj = new URL(url);
            const pathname = decodeURIComponent(urlObj.pathname);
            const relativePath = pathname.startsWith('/') ? pathname.substring(1) : pathname;
            const localPath = path.join(uploadsDir, relativePath);
            if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
                const buf = fs.readFileSync(localPath);
                syncLog("[getEvidenceBuffer] Direct local file read success: " + localPath);
                return buf;
            }
        }
    } catch (e) {
        syncLog("[getEvidenceBuffer] Local path resolution error: " + e.message);
    }

    // 2. AWS S3 Get Object
    if (s3 && (url.includes('amazonaws.com') || url.includes('s3.'))) {
        try {
            const urlObj = new URL(url);
            let s3Key = urlObj.pathname;
            
            // Extract key starting with media/ or chunks/ (v87.1)
            const mediaIndex = s3Key.indexOf('/media/');
            const chunksIndex = s3Key.indexOf('/chunks/');
            if (mediaIndex !== -1) {
                s3Key = s3Key.substring(mediaIndex + 1);
            } else if (chunksIndex !== -1) {
                s3Key = s3Key.substring(chunksIndex + 1);
            } else {
                const bucketPrefix = `/${process.env.BUCKET_NAME}/`;
                if (s3Key.startsWith(bucketPrefix)) {
                    s3Key = s3Key.substring(bucketPrefix.length);
                } else if (s3Key.startsWith('/')) {
                    s3Key = s3Key.substring(1);
                }
            }

            syncLog("[getEvidenceBuffer] Attempting S3 fetch: " + s3Key);
            const s3Data = await s3.getObject({
                Bucket: process.env.BUCKET_NAME,
                Key: decodeURIComponent(s3Key)
            }).promise();
            syncLog("[getEvidenceBuffer] S3 fetch success. Size: " + s3Data.Body.length);
            return s3Data.Body;
        } catch (e) {
            syncLog("[getEvidenceBuffer] S3 Get Object Error: " + e.message);
            console.error("[GDrive-Sync S3 Get Error]:", e.message);
        }
    }

    // 3. HTTP URL Fetch
    if (url.startsWith('http')) {
        try {
            syncLog("[getEvidenceBuffer] Attempting HTTP fetch: " + url);
            return new Promise((resolve) => {
                https.get(url, (res) => {
                    if (res.statusCode !== 200) {
                        syncLog("[getEvidenceBuffer] HTTP fetch failed. Status: " + res.statusCode);
                        resolve(null);
                        return;
                    }
                    const chunks = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => {
                        const buf = Buffer.concat(chunks);
                        syncLog("[getEvidenceBuffer] HTTP fetch success. Size: " + buf.length);
                        resolve(buf);
                    });
                }).on('error', (err) => {
                    syncLog("[getEvidenceBuffer] HTTP Request Error: " + err.message);
                    resolve(null);
                });
            });
        } catch (e) {
            syncLog("[getEvidenceBuffer] HTTP Fetch Catch Error: " + e.message);
            console.warn("[GDrive-Sync HTTP Fetch Error]:", e.message);
        }
    }

    // 4. Recursive subdirectory search by basename fallback (v87.1)
    try {
        const basename = path.basename(url);
        const subDirs = ['', 'media/photos', 'media/videos', 'media/others'];
        for (const subDir of subDirs) {
            const localPath = path.join(uploadsDir, subDir, basename);
            if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
                const buf = fs.readFileSync(localPath);
                syncLog("[getEvidenceBuffer] Local File (recursive search) read success: " + localPath);
                return buf;
            }
        }
    } catch (e) {
        syncLog("[getEvidenceBuffer] Local File Read Error: " + e.message);
        console.error("[GDrive-Sync Local File Error]:", e);
    }

    syncLog("[getEvidenceBuffer] Failed to retrieve buffer for URL: " + url);
    return null;
};

// Database helper wrapper for Promises
const getTableData = (table) => {
    return new Promise((resolve, reject) => {
        dbAdapter.getAll(table, (err, rows) => {
            if (err) return reject(err);
            try {
                const items = rows.map(r => JSON.parse(r.data));
                resolve(items);
            } catch (e) { reject(e); }
        });
    });
};

// Generate Student Credentials PDF Buffer
function generateStudentCredentialsPDF(batchName, students) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // --- Header ---
            doc.rect(0, 0, doc.page.width, 70).fill('#1e3a8a');
            doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
               .text('Student Login Credentials', 40, 20, { align: 'center' });
            doc.fontSize(11).font('Helvetica')
               .text(`Batch: ${batchName}`, 40, 46, { align: 'center' });

            doc.moveDown(3);

            // --- Table Header ---
            const tableTop = 90;
            const colX = { sno: 40, name: 80, username: 320, password: 440 };
            const rowH = 24;

            // Header background
            doc.rect(40, tableTop, doc.page.width - 80, rowH).fill('#1e40af');
            doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
            doc.text('S.No', colX.sno, tableTop + 7, { width: 35, align: 'center' });
            doc.text('Name', colX.name, tableTop + 7, { width: 235, align: 'left' });
            doc.text('Username', colX.username, tableTop + 7, { width: 115, align: 'left' });
            doc.text('Password', colX.password, tableTop + 7, { width: 115, align: 'left' });

            // --- Table Rows ---
            doc.font('Helvetica').fontSize(9).fillColor('#1e293b');
            let y = tableTop + rowH;
            students.forEach((s, i) => {
                const bg = i % 2 === 0 ? '#f0f4ff' : '#ffffff';
                doc.rect(40, y, doc.page.width - 80, rowH).fill(bg);
                // Row border
                doc.rect(40, y, doc.page.width - 80, rowH).stroke('#d1d5db');
                doc.fillColor('#1e293b');
                doc.text(String(i + 1), colX.sno, y + 7, { width: 35, align: 'center' });
                doc.text(s.name || '', colX.name, y + 7, { width: 235, align: 'left' });
                doc.text(String(s.username || ''), colX.username, y + 7, { width: 115, align: 'left' });
                doc.text(String(s.password || s.enrollmentNo || ''), colX.password, y + 7, { width: 115, align: 'left' });
                y += rowH;

                // New page if overflow
                if (y > doc.page.height - 60) {
                    doc.addPage();
                    y = 40;
                    // Repeat header on new page
                    doc.rect(40, y, doc.page.width - 80, rowH).fill('#1e40af');
                    doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
                    doc.text('S.No', colX.sno, y + 7, { width: 35, align: 'center' });
                    doc.text('Name', colX.name, y + 7, { width: 235, align: 'left' });
                    doc.text('Username', colX.username, y + 7, { width: 115, align: 'left' });
                    doc.text('Password', colX.password, y + 7, { width: 115, align: 'left' });
                    doc.font('Helvetica').fontSize(9).fillColor('#1e293b');
                    y += rowH;
                }
            });

            // --- Footer ---
            doc.fillColor('#64748b').fontSize(8)
               .text(`Generated on ${new Date().toLocaleDateString('en-IN')} | Total Students: ${students.length}`,
                   40, doc.page.height - 30, { align: 'center', width: doc.page.width - 80 });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// Background Google Drive Sync State
const gdriveSyncs = {};

// Helper to automatically trigger Google Drive sync for responses (v87.1)
function triggerGDriveSyncForResponses(responses) {
    if (!responses || responses.length === 0) return;
    
    const studentIds = [...new Set(responses.map(r => r.studentId).filter(Boolean))];
    if (studentIds.length === 0) return;
    
    dbAdapter.getAll('students', (err, studentRows) => {
        if (err || !studentRows) return;
        const students = studentRows.map(r => { try { return JSON.parse(r.data); } catch(e) { return null; } }).filter(Boolean);
        
        const affectedBatchIds = new Set();
        studentIds.forEach(sid => {
            const student = students.find(s => s.id === sid || s.username === sid);
            if (student && student.batchId) {
                affectedBatchIds.add(student.batchId);
            }
        });
        
        if (affectedBatchIds.size === 0) return;
        
        dbAdapter.getAll('batches', (err2, batchRows) => {
            if (err2 || !batchRows) return;
            const batches = batchRows.map(r => { try { return JSON.parse(r.data); } catch(e) { return null; } }).filter(Boolean);
            
            affectedBatchIds.forEach(bId => {
                const batch = batches.find(b => b.id === bId);
                if (batch) {
                    gdriveSyncs[bId] = {
                        status: 'syncing',
                        progress: 'Auto-syncing after response upload...',
                        completed: 0,
                        total: 0,
                        error: null
                    };
                    runGDriveSync(bId, batch.name);
                }
            });
        });
    });
}

// Background sync worker function
async function runGDriveSync(batchId, batchName) {
    // Concurrency Guard (v87.1)
    if (gdriveSyncs[batchId] && gdriveSyncs[batchId].status === 'syncing' && gdriveSyncs[batchId].startedAt) {
        const timeSinceStart = Date.now() - gdriveSyncs[batchId].startedAt;
        if (timeSinceStart < 300000) { // 5-minute safety timeout
            syncLog(`Sync already in progress for batchId: ${batchId} (started ${Math.round(timeSinceStart / 1000)}s ago). Skipping concurrent execution.`);
            return;
        }
    }

    try {
        if (!gdriveSyncs[batchId]) {
            gdriveSyncs[batchId] = {
                status: 'syncing',
                progress: 'Starting background job...',
                completed: 0,
                total: 0,
                error: null
            };
        }
        gdriveSyncs[batchId].startedAt = Date.now();

        syncLog("=== START SYNC WORKER ===");
        syncLog(`batchId: ${batchId}, batchName: ${batchName}`);
        
        let token = null;
        const oauthCreds = getGoogleOAuthCredentials();
        if (oauthCreds) {
            syncLog("OAuth 2.0 credentials found. Authenticating via OAuth...");
            gdriveSyncs[batchId].progress = 'Authenticating with Google OAuth...';
            token = await getGoogleAccessTokenForOAuth(oauthCreds);
            syncLog("Authenticated with Google OAuth successfully.");
        } else {
            syncLog("No OAuth 2.0 credentials found. Falling back to Service Account...");
            const creds = getGoogleCredentials();
            if (!creds) {
                syncLog("Google credentials are missing!");
                throw new Error("Google credentials are missing. Please configure GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN or GOOGLE_CREDENTIALS environment variable.");
            }
            gdriveSyncs[batchId].progress = 'Authenticating with Google Service Account...';
            token = await getGoogleAccessToken(creds);
            syncLog("Authenticated with Google Service Account successfully.");
        }

        gdriveSyncs[batchId].progress = 'Retrieving database records...';
        const students = (await getTableData('students')).filter(s => s.batchId === batchId);
        const allResponses = await getTableData('responses');
        const batches = await getTableData('batches');
        const batch = batches.find(b => b.id === batchId) || { name: batchName };
        syncLog(`Students in batch: ${students.length}, Total responses in DB: ${allResponses.length}`);

        const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1tv8GLA-8XWLGDnnzbMN4ivdf5uinvbOE';
        
        // 1. Determine Year and Month Folder Names (restructured nested folders)
        gdriveSyncs[batchId].progress = 'Structuring Year and Month folders...';
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        
        let startDate = new Date();
        if (batch.startDate) {
            const d = new Date(batch.startDate);
            if (!isNaN(d.getTime())) startDate = d;
        }

        const startYearName = `${startDate.getFullYear()}`;
        const startMonthName = monthNames[startDate.getMonth()];
        syncLog(`Start Date: Year=${startYearName}, Month=${startMonthName}`);

        // Find/Create Year Folder for Start Date under parent folder
        let startYearFolderId = await findGDriveFolder(token, startYearName, parentFolderId);
        if (!startYearFolderId) {
            startYearFolderId = await createGDriveFolder(token, startYearName, parentFolderId);
            syncLog(`Created Year Folder '${startYearName}' ID: ${startYearFolderId}`);
        } else {
            syncLog(`Found Year Folder '${startYearName}' ID: ${startYearFolderId}`);
        }

        // Find/Create Month Folder for Start Date under Year folder
        let startMonthFolderId = await findGDriveFolder(token, startMonthName, startYearFolderId);
        if (!startMonthFolderId) {
            startMonthFolderId = await createGDriveFolder(token, startMonthName, startYearFolderId);
            syncLog(`Created Month Folder '${startMonthName}' ID: ${startMonthFolderId}`);
        } else {
            syncLog(`Found Month Folder '${startMonthName}' ID: ${startMonthFolderId}`);
        }

        let monthFolderId = startMonthFolderId;

        // 2. Create/Find Batch Folder inside Month folder
        gdriveSyncs[batchId].progress = 'Structuring Batch folder...';
        const batchDirName = batch.name.replace(/ /g, '_');
        let batchFolderId = await findGDriveFolder(token, batchDirName, monthFolderId);
        if (!batchFolderId) {
            batchFolderId = await createGDriveFolder(token, batchDirName, monthFolderId);
            syncLog(`Created Batch Folder ID: ${batchFolderId}`);
        } else {
            syncLog(`Found Batch Folder ID: ${batchFolderId}`);
        }

        // 3. Create/Find the 4 subfolders under batchFolderId
        gdriveSyncs[batchId].progress = 'Structuring batch categories...';
        const subFolderNames = ['photos', 'videos', 'documents', 'evidence of each student'];
        const subFolderIds = {};
        for (const name of subFolderNames) {
            let fid = await findGDriveFolder(token, name, batchFolderId);
            if (!fid) {
                fid = await createGDriveFolder(token, name, batchFolderId);
                syncLog(`Created subfolder '${name}' ID: ${fid}`);
            } else {
                syncLog(`Found subfolder '${name}' ID: ${fid}`);
            }
            subFolderIds[name] = fid;
        }

        // 4. Gather all candidate evidence files to compile tasks list
        gdriveSyncs[batchId].progress = 'Analyzing candidate evidence...';
        const uploadTasks = [];
        for (const s of students) {
            const studentResponses = allResponses.filter(r => r.studentId === s.id || r.studentId === s.username);
            const videoCountMap = { theory: 0, practical: 0, viva: 0 };
            
            syncLog(`Student: ${s.name} (${s.username}), responses found: ${studentResponses.length}`);

            for (const resp of studentResponses) {
                const rawExamType = (resp.examType || '').toLowerCase();
                if (resp.evidence && Array.isArray(resp.evidence)) {
                    for (const item of resp.evidence) {
                        const isManual = (item.type || '').toUpperCase().includes('MANUAL') || rawExamType === 'photo';
                        const isVideo = (item.type || '').toUpperCase().includes('VIDEO') || 
                                        (item.url || item.img || '').toLowerCase().endsWith('.webm') || 
                                        (item.url || item.img || '').toLowerCase().endsWith('.mp4');

                        if (isVideo) {
                            let targetExamType = 'theory';
                            if (rawExamType.includes('practical')) targetExamType = 'practical';
                            else if (rawExamType.includes('viva')) targetExamType = 'viva';
                            else if (rawExamType.includes('theory')) targetExamType = 'theory';
                            else continue;

                            videoCountMap[targetExamType]++;
                            const fileSuffix = videoCountMap[targetExamType] > 1 ? `_${videoCountMap[targetExamType]}` : '';
                            
                            uploadTasks.push({
                                student: s,
                                item: item,
                                type: 'video',
                                targetExamType: targetExamType,
                                fileSuffix: fileSuffix
                            });
                        } else {
                            let categoryLabel = 'other';
                            if (isManual) categoryLabel = 'manual';
                            else if (rawExamType.includes('theory')) categoryLabel = 'theory';
                            else if (rawExamType.includes('practical')) categoryLabel = 'practical';
                            else if (rawExamType.includes('viva')) categoryLabel = 'viva';

                            uploadTasks.push({
                                student: s,
                                item: item,
                                type: 'photo',
                                categoryLabel: categoryLabel
                            });
                        }
                    }
                }
            }
        }

        const totalTasks = uploadTasks.length;
        gdriveSyncs[batchId].total = totalTasks;
        syncLog(`Total upload tasks gathered: ${totalTasks}`);

        // 5. Generate and upload Student Credentials PDF to 'documents' folder (ALWAYS overwrite)
        try {
            gdriveSyncs[batchId].progress = 'Generating student credentials PDF...';
            syncLog('Generating student credentials PDF...');
            const pdfBuffer = await generateStudentCredentialsPDF(batch.name, students);
            const pdfFileName = `Student_Credentials_${batch.name.replace(/ /g, '_')}.pdf`;

            // Delete old PDF if exists, then upload fresh one
            const existingPDFId = await findGDriveFile(token, pdfFileName, subFolderIds['documents']);
            if (existingPDFId) {
                await deleteGDriveFile(token, existingPDFId);
                syncLog(`Deleted old credentials PDF: ${pdfFileName}`);
            }
            await uploadGDriveFile(token, pdfFileName, 'application/pdf', subFolderIds['documents'], pdfBuffer);
            syncLog(`Uploaded fresh credentials PDF: ${pdfFileName} (${students.length} students)`);
        } catch (pdfErr) {
            syncLog(`Warning: Could not generate/upload credentials PDF: ${pdfErr.message}`);
            console.warn('[GDrive-Sync] PDF upload error:', pdfErr.message);
        }

        if (totalTasks === 0) {
            gdriveSyncs[batchId].status = 'completed';
            gdriveSyncs[batchId].progress = 'Sync complete! Student credentials PDF uploaded to documents folder.';
            syncLog("Sync complete: No media tasks, but PDF uploaded.");
            return;
        }

        let completed = 0;
        for (const task of uploadTasks) {
            gdriveSyncs[batchId].progress = `Syncing: ${task.student.name} (${completed + 1}/${totalTasks})`;
            syncLog(`Processing task: student=${task.student.name}, type=${task.type}, url=${task.item.url || task.item.img}`);

            try {
                const studentDirName = `${task.student.name}_${task.student.username}`.replace(/ /g, '_').replace(/[^a-zA-Z0-9_]/g, '');
                let studentFolderId = await findGDriveFolder(token, studentDirName, subFolderIds['evidence of each student']);
                if (!studentFolderId) {
                    studentFolderId = await createGDriveFolder(token, studentDirName, subFolderIds['evidence of each student']);
                    syncLog(`Created student folder '${studentDirName}' ID: ${studentFolderId}`);
                }

                const buffer = await getEvidenceBuffer(task.item);
                if (buffer) {
                    if (task.type === 'video') {
                        const ext = (task.item.url || task.item.img || '').toLowerCase().endsWith('.mp4') ? 'mp4' : 'webm';
                        const mimeType = `video/${ext}`;

                        const sharedFileName = `${task.student.username}_${task.student.name}_${task.targetExamType}${task.fileSuffix}.${ext}`.replace(/ /g, '_');
                        let fileIdShared = await findGDriveFile(token, sharedFileName, subFolderIds['videos']);
                        if (!fileIdShared) {
                            syncLog(`Uploading video to shared folder: ${sharedFileName}`);
                            fileIdShared = await uploadGDriveFile(token, sharedFileName, mimeType, subFolderIds['videos'], buffer);
                        } else {
                            syncLog(`Video already exists in shared folder: ${sharedFileName}`);
                        }

                        const personalFileName = `${task.targetExamType}${task.fileSuffix}.${ext}`;
                        let fileIdPersonal = await findGDriveFile(token, personalFileName, studentFolderId);
                        if (!fileIdPersonal) {
                            syncLog(`Uploading video to student folder: ${personalFileName}`);
                            fileIdPersonal = await uploadGDriveFile(token, personalFileName, mimeType, studentFolderId, buffer);
                        } else {
                            syncLog(`Video already exists in student folder: ${personalFileName}`);
                        }
                    } else if (task.type === 'photo') {
                        const label = (task.item.type || 'Photo').replace(/[^a-zA-Z0-9_]/g, '_');
                        const time = (task.item.time || new Date().toISOString()).slice(0, 19).replace(/:/g, '-');

                        const sharedFileName = `${task.student.username}_${task.student.name}_${task.categoryLabel}_${label}_${time}.jpg`.replace(/ /g, '_');
                        let fileIdShared = await findGDriveFile(token, sharedFileName, subFolderIds['photos']);
                        if (!fileIdShared) {
                            syncLog(`Uploading photo to shared folder: ${sharedFileName}`);
                            fileIdShared = await uploadGDriveFile(token, sharedFileName, 'image/jpeg', subFolderIds['photos'], buffer);
                        } else {
                            syncLog(`Photo already exists in shared folder: ${sharedFileName}`);
                        }

                        const personalFileName = `${task.categoryLabel}_${label}_${time}.jpg`.replace(/ /g, '_');
                        let fileIdPersonal = await findGDriveFile(token, personalFileName, studentFolderId);
                        if (!fileIdPersonal) {
                            syncLog(`Uploading photo to student folder: ${personalFileName}`);
                            fileIdPersonal = await uploadGDriveFile(token, personalFileName, 'image/jpeg', studentFolderId, buffer);
                        } else {
                            syncLog(`Photo already exists in student folder: ${personalFileName}`);
                        }
                    }
                } else {
                    syncLog(`Skipping task because file buffer is NULL.`);
                }
            } catch (err) {
                syncLog(`Error processing task: ${err.message}`);
                console.error(`[GDrive-Sync] Failed file uploads for candidate ${task.student.name}:`, err.message);
            }

            completed++;
            gdriveSyncs[batchId].completed = completed;
        }

        gdriveSyncs[batchId].status = 'completed';
        gdriveSyncs[batchId].progress = `Sync complete! Successfully synchronized ${completed} files to Google Drive.`;
        syncLog(`=== SYNC WORKER COMPLETE. Uploaded ${completed}/${totalTasks} tasks ===`);
    } catch (err) {
        syncLog(`Worker CRITICAL error: ${err.message}`);
        console.error("[GDrive-Sync Worker Error]:", err);
        gdriveSyncs[batchId].status = 'error';
        gdriveSyncs[batchId].error = err.message;
        gdriveSyncs[batchId].progress = `Failed: ${err.message}`;
    }
}

// 1. Endpoint: Trigger Google Drive Sync
app.post('/api/sync-to-gdrive', async (req, res) => {
    const { batchId } = req.body;
    if (!batchId) return res.status(400).json({ error: "Missing batchId" });

    const creds = getGoogleCredentials();
    const oauthCreds = getGoogleOAuthCredentials();
    if (!creds && !oauthCreds) {
        return res.status(500).json({ error: "Google credentials not configured on the server. Please configure GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN or GOOGLE_CREDENTIALS." });
    }

    if (gdriveSyncs[batchId] && gdriveSyncs[batchId].status === 'syncing') {
        return res.json({ success: true, message: "Sync already in progress." });
    }

    try {
        // Fetch batch details to get batch name
        dbAdapter.getAll('batches', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const batches = rows.map(r => JSON.parse(r.data));
            const batch = batches.find(b => b.id === batchId);
            if (!batch) return res.status(404).json({ error: "Batch not found" });

            gdriveSyncs[batchId] = {
                status: 'syncing',
                progress: 'Starting background job...',
                completed: 0,
                total: 0,
                error: null
            };

            // Launch worker async
            runGDriveSync(batchId, batch.name);

            res.json({ success: true, message: "Google Drive sync started." });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Endpoint: Poll Sync Progress
app.get('/api/sync-to-gdrive/status/:batchId', (req, res) => {
    const { batchId } = req.params;
    const syncState = gdriveSyncs[batchId] || { status: 'idle', progress: 'No sync active.' };
    res.json(syncState);
});

// 3. Endpoint: Read Sync Logs (Diagnostics)
app.get('/api/sync-log', (req, res) => {
    const logPath = path.join(__dirname, '../sync.log');
    if (fs.existsSync(logPath)) {
        res.setHeader('Content-Type', 'text/plain');
        res.send(fs.readFileSync(logPath, 'utf8'));
    } else {
        res.send("No log file found.");
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
