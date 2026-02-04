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

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

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
    // Skip auth for simple GET (optional, but safer to protect everything)
    // or allow public read? No, protect all data.
    const clientKey = req.headers['x-api-key'];
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
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

class DatabaseAdapter {
    constructor() {
        this.type = process.env.DATABASE_URL ? 'postgres' : 'sqlite';
        console.log("========================================");
        console.log(`DATABASE ADAPTER: ${this.type.toUpperCase()}`);
        console.log(`Has DATABASE_URL: ${!!process.env.DATABASE_URL}`);
        console.log("========================================");

        if (this.type === 'postgres') {
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false } // Required for Render
            });
        } else {
            this.db = new sqlite3.Database('./database.sqlite', (err) => {
                if (err) console.error("Database Error:", err);
                else console.log("Connected to SQLite Database");
            });
        }
    }

    init() {
        const tables = [
            "batches", "students", "qps", "nos", "pcs", "responses", "ssc", "question_papers"
        ];

        // Define schemas
        const schema = {
            postgres: (table) => `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT)`,
            sqlite: (table) => `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT)`
        };

        tables.forEach(table => {
            if (this.type === 'postgres') {
                this.pool.query(schema.postgres(table)).catch(err => console.error(`Error creating table ${table}:`, err));
            } else {
                this.db.run(schema.sqlite(table));
            }
        });
    }

    getAll(table, callback) {
        if (this.type === 'postgres') {
            this.pool.query(`SELECT data FROM ${table}`, (err, res) => {
                if (err) return callback(err, null);
                callback(null, res.rows);
            });
        } else {
            this.db.all(`SELECT data FROM ${table}`, [], callback);
        }
    }

    upsert(table, id, dataStr, callback) {
        if (this.type === 'postgres') {
            // Postgres UPSERT
            const query = `
                INSERT INTO ${table} (id, data) VALUES ($1, $2)
                ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
            `;
            this.pool.query(query, [id, dataStr], callback);
        } else {
            // SQLite UPSERT
            this.db.run(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`, [id, dataStr], callback);
        }
    }

    delete(table, id, callback) {
        if (this.type === 'postgres') {
            this.pool.query(`DELETE FROM ${table} WHERE id = $1`, [id], callback);
        } else {
            this.db.run(`DELETE FROM ${table} WHERE id = ?`, [id], callback);
        }
    }

    sync(table, items, callback) {
        // SAFE SYNC: MERGE (UPSERT) instead of REPLACE
        if (this.type === 'postgres') {
            (async () => {
                const client = await this.pool.connect();
                try {
                    await client.query('BEGIN');
                    // DO NOT DELETE. ONLY UPSERT.
                    // Upsert Query for Postgres
                    const query = `
                        INSERT INTO ${table} (id, data) VALUES ($1, $2)
                        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
                    `;
                    for (const item of items) {
                        await client.query(query, [item.id, JSON.stringify(item)]);
                    }
                    await client.query('COMMIT');
                    callback(null);
                } catch (e) {
                    await client.query('ROLLBACK');
                    callback(e);
                } finally {
                    client.release();
                }
            })();
        } else {
            // SQLite Upsert
            this.db.serialize(() => {
                // DO NOT DELETE.
                const stmt = this.db.prepare(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`);
                items.forEach(item => {
                    stmt.run(item.id, JSON.stringify(item));
                });
                stmt.finalize((err) => {
                    callback(err);
                });
            });
        }
    }
}

// Initialize Adapter
const dbAdapter = new DatabaseAdapter();
dbAdapter.init();

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

        dbAdapter.sync(tableName, items, (err) => {
            if (err) return res.status(500).json({ error: err && err.message });
            io.emit('data-change', { table: tableName, action: 'sync' });
            res.json({ success: true, count: items.length });
        });
    });
}

createCRUDEndpoints('batches', 'batches');
createCRUDEndpoints('students', 'students');
createCRUDEndpoints('qps', 'qps');
createCRUDEndpoints('nos', 'nos');
createCRUDEndpoints('pcs', 'pcs');
createCRUDEndpoints('responses', 'responses');
createCRUDEndpoints('ssc', 'ssc');

createCRUDEndpoints('question_papers', 'question_papers');

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
