import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine which database to use based on environment
const isProduction = process.env.NODE_ENV === 'production';
const usePostgres = isProduction || process.env.DATABASE_URL;

let db;
let dbGet, dbAll;

if (usePostgres) {
    // PostgreSQL setup
    console.log('🐘 Using PostgreSQL database');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('render.com') ? {
            rejectUnauthorized: false
        } : undefined
    });

    // Create helper functions that mimic SQLite API
    dbGet = async (query, params = []) => {
        const result = await pool.query(query, params);
        return result.rows[0];
    };

    dbAll = async (query, params = []) => {
        const result = await pool.query(query, params);
        return result.rows;
    };

    db = {
        run: async (query, params = []) => {
            const result = await pool.query(query, params);
            return { 
                lastID: result.rows[0]?.id, 
                changes: result.rowCount 
            };
        },
        get: dbGet,
        all: dbAll,
        serialize: (callback) => callback(), // No-op for Postgres
        pool
    };

    // Initialize PostgreSQL tables
    await initializePostgresTables();

} else {
    // SQLite setup (for development)
    console.log('💾 Using SQLite database');
    
    const sqliteDb = new sqlite3.Database(join(__dirname, 'sweetteams.db'));
    
    dbGet = promisify(sqliteDb.get.bind(sqliteDb));
    dbAll = promisify(sqliteDb.all.bind(sqliteDb));
    
    // Enable foreign keys
    sqliteDb.run('PRAGMA foreign_keys = ON');
    
    db = sqliteDb;
    
    // Initialize SQLite tables
    initializeSqliteTables();
}

async function initializePostgresTables() {
    const client = db.pool;
    
    try {
        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                profile_picture TEXT,
                is_admin INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // User preferences table
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_preferences (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL,
                default_microphone TEXT,
                default_camera TEXT,
                default_speaker TEXT,
                notifications_enabled INTEGER DEFAULT 1,
                auto_join_audio INTEGER DEFAULT 1,
                auto_join_video INTEGER DEFAULT 1,
                dark_mode INTEGER DEFAULT 0,
                language TEXT DEFAULT 'en',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // Add dark_mode column if it doesn't exist (for existing databases)
        await client.query(`
            ALTER TABLE user_preferences 
            ADD COLUMN IF NOT EXISTS dark_mode INTEGER DEFAULT 0
        `).catch(() => {});
        
        // Add language column if it doesn't exist (for existing databases)
        await client.query(`
            ALTER TABLE user_preferences 
            ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en'
        `).catch(() => {});

        // Rooms table
        await client.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                creator_id INTEGER NOT NULL,
                link_code TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator_id) REFERENCES users(id)
            )
        `);

        // Room participants table
        await client.query(`
            CREATE TABLE IF NOT EXISTS room_participants (
                id SERIAL PRIMARY KEY,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(room_id, user_id)
            )
        `);

        // Magic links table
        await client.query(`
            CREATE TABLE IF NOT EXISTS magic_links (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL,
                name TEXT NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                used INTEGER DEFAULT 0
            )
        `);

        // Guest sessions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS guest_sessions (
                id TEXT PRIMARY KEY,
                guest_name TEXT NOT NULL,
                link_code TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            )
        `);
        
        // Add is_admin column if it doesn't exist (migration)
        try {
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin INTEGER DEFAULT 0
            `);
            console.log('✅ Ensured is_admin column exists');
        } catch (err) {
            // Column might already exist, ignore error
            console.log('is_admin column check:', err.message);
        }

        console.log('✅ PostgreSQL tables initialized');
    } catch (err) {
        console.error('❌ Error initializing PostgreSQL tables:', err);
        throw err;
    }
}

function initializeSqliteTables() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                profile_picture TEXT,
                is_admin INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration: Add columns if they don't exist
        db.all("PRAGMA table_info(users)", [], (err, columns) => {
            if (err) {
                console.error('Error checking users table:', err);
                return;
            }
            
            const hasProfilePicture = columns.some(col => col.name === 'profile_picture');
            const hasIsAdmin = columns.some(col => col.name === 'is_admin');
            
            if (!hasProfilePicture) {
                db.run('ALTER TABLE users ADD COLUMN profile_picture TEXT', (err) => {
                    if (err) {
                        console.error('Error adding profile_picture column:', err);
                    } else {
                        console.log('✅ Added profile_picture column to users table');
                    }
                });
            }
            
            if (!hasIsAdmin) {
                db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0', (err) => {
                    if (err) {
                        console.error('Error adding is_admin column:', err);
                    } else {
                        console.log('✅ Added is_admin column to users table');
                    }
                });
            }
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                default_microphone TEXT,
                default_camera TEXT,
                default_speaker TEXT,
                notifications_enabled INTEGER DEFAULT 1,
                auto_join_audio INTEGER DEFAULT 1,
                auto_join_video INTEGER DEFAULT 1,
                dark_mode INTEGER DEFAULT 0,
                language TEXT DEFAULT 'en',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // Add dark_mode column if it doesn't exist (for existing databases)
        db.run(`
            ALTER TABLE user_preferences ADD COLUMN dark_mode INTEGER DEFAULT 0
        `, () => {});
        
        // Add language column if it doesn't exist (for existing databases)
        db.run(`
            ALTER TABLE user_preferences ADD COLUMN language TEXT DEFAULT 'en'
        `, () => {});

        db.run(`
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                creator_id INTEGER NOT NULL,
                link_code TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator_id) REFERENCES users(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS room_participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(room_id, user_id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS magic_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                name TEXT NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                used INTEGER DEFAULT 0
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS guest_sessions (
                id TEXT PRIMARY KEY,
                guest_name TEXT NOT NULL,
                link_code TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL
            )
        `);
    });
}

// Ensure dev user exists for development mode
export function ensureDevUser() {
    return new Promise(async (resolve, reject) => {
        if (process.env.NODE_ENV !== 'development') {
            resolve();
            return;
        }
        
        try {
            if (usePostgres) {
                await db.pool.query(`
                    INSERT INTO users (id, username, email, password_hash)
                    VALUES (999999, 'SweetTeams-Dev', 'dev@localhost', '')
                    ON CONFLICT (id) DO NOTHING
                `);
            } else {
                db.run(`
                    INSERT OR IGNORE INTO users (id, username, email, password_hash)
                    VALUES (999999, 'SweetTeams-Dev', 'dev@localhost', '')
                `, (err) => {
                    if (err) {
                        console.error('❌ Error creating dev user:', err);
                        reject(err);
                        return;
                    }
                });
            }
            console.log('✅ Dev user ready');
            resolve();
        } catch (err) {
            console.error('❌ Error creating dev user:', err);
            reject(err);
        }
    });
}

// Database functions
export function createUser(username, email, passwordHash = null) {
    return new Promise(async (resolve, reject) => {
        try {
            if (usePostgres) {
                const result = await db.pool.query(
                    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
                    [username, email, passwordHash || '']
                );
                resolve({ lastID: result.rows[0].id });
            } else {
                db.run(
                    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                    [username, email, passwordHash || ''],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ lastID: this.lastID });
                    }
                );
            }
        } catch (err) {
            reject(err);
        }
    });
}

export async function findUserByEmail(email) {
    if (usePostgres) {
        return await dbGet('SELECT * FROM users WHERE email = $1', [email]);
    }
    return await dbGet('SELECT * FROM users WHERE email = ?', [email]);
}

export async function findUserByUsername(username) {
    if (usePostgres) {
        return await dbGet('SELECT * FROM users WHERE username = $1', [username]);
    }
    return await dbGet('SELECT * FROM users WHERE username = ?', [username]);
}

export async function findUserById(id) {
    if (usePostgres) {
        return await dbGet('SELECT id, username, email, profile_picture, is_admin, created_at FROM users WHERE id = $1', [id]);
    }
    return await dbGet('SELECT id, username, email, profile_picture, is_admin, created_at FROM users WHERE id = ?', [id]);
}

export function createRoom(name, creatorId, linkCode) {
    return new Promise(async (resolve, reject) => {
        try {
            if (usePostgres) {
                const result = await db.pool.query(
                    'INSERT INTO rooms (name, creator_id, link_code) VALUES ($1, $2, $3) RETURNING id',
                    [name, creatorId, linkCode]
                );
                resolve({ lastID: result.rows[0].id });
            } else {
                db.run(
                    'INSERT INTO rooms (name, creator_id, link_code) VALUES (?, ?, ?)',
                    [name, creatorId, linkCode],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ lastID: this.lastID });
                    }
                );
            }
        } catch (err) {
            reject(err);
        }
    });
}

export async function findRoomByLinkCode(linkCode) {
    if (usePostgres) {
        return await dbGet(
            `SELECT r.*, u.username as creator_username
             FROM rooms r
             JOIN users u ON r.creator_id = u.id
             WHERE r.link_code = $1`,
            [linkCode]
        );
    }
    return await dbGet(
        `SELECT r.*, u.username as creator_username
         FROM rooms r
         JOIN users u ON r.creator_id = u.id
         WHERE r.link_code = ?`,
        [linkCode]
    );
}

export async function findRoomsByCreator(creatorId) {
    if (usePostgres) {
        return await dbAll(
            'SELECT * FROM rooms WHERE creator_id = $1 ORDER BY created_at DESC',
            [creatorId]
        );
    }
    return await dbAll(
        'SELECT * FROM rooms WHERE creator_id = ? ORDER BY created_at DESC',
        [creatorId]
    );
}

export function addRoomParticipant(roomId, userId) {
    return new Promise(async (resolve, reject) => {
        try {
            if (usePostgres) {
                await db.pool.query(
                    'INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [roomId, userId]
                );
                resolve();
            } else {
                db.run(
                    'INSERT OR IGNORE INTO room_participants (room_id, user_id) VALUES (?, ?)',
                    [roomId, userId],
                    function (err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            }
        } catch (err) {
            reject(err);
        }
    });
}

export async function getRoomParticipants(roomId) {
    if (usePostgres) {
        return await dbAll(
            `SELECT u.id, u.username, rp.joined_at
             FROM room_participants rp
             JOIN users u ON rp.user_id = u.id
             WHERE rp.room_id = $1
             ORDER BY rp.joined_at`,
            [roomId]
        );
    }
    return await dbAll(
        `SELECT u.id, u.username, rp.joined_at
         FROM room_participants rp
         JOIN users u ON rp.user_id = u.id
         WHERE rp.room_id = ?
         ORDER BY rp.joined_at`,
        [roomId]
    );
}

export function deleteRoom(linkCodeOrId) {
    return new Promise(async (resolve, reject) => {
        try {
            const isId = typeof linkCodeOrId === 'number';
            
            if (usePostgres) {
                const query = isId ? 'DELETE FROM rooms WHERE id = $1' : 'DELETE FROM rooms WHERE link_code = $1';
                const deleteParticipantsQuery = isId
                    ? 'DELETE FROM room_participants WHERE room_id = $1'
                    : 'DELETE FROM room_participants WHERE room_id = (SELECT id FROM rooms WHERE link_code = $1)';

                await db.pool.query(deleteParticipantsQuery, [linkCodeOrId]);
                const result = await db.pool.query(query, [linkCodeOrId]);
                resolve(result.rowCount);
            } else {
                const query = isId ? 'DELETE FROM rooms WHERE id = ?' : 'DELETE FROM rooms WHERE link_code = ?';
                const deleteParticipantsQuery = isId
                    ? 'DELETE FROM room_participants WHERE room_id = ?'
                    : 'DELETE FROM room_participants WHERE room_id = (SELECT id FROM rooms WHERE link_code = ?)';

                db.serialize(() => {
                    db.run(deleteParticipantsQuery, [linkCodeOrId], (err) => {
                        if (err) console.error('Error deleting participants:', err);
                    });
                    db.run(query, [linkCodeOrId], function (err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    });
                });
            }
        } catch (err) {
            reject(err);
        }
    });
}

// Magic link functions
export function createMagicLink(email, name, token, expiresAt) {
    return new Promise(async (resolve, reject) => {
        try {
            if (usePostgres) {
                const result = await db.pool.query(
                    'INSERT INTO magic_links (email, name, token, expires_at) VALUES ($1, $2, $3, $4) RETURNING id',
                    [email, name, token, expiresAt]
                );
                resolve({ lastID: result.rows[0].id });
            } else {
                db.run(
                    'INSERT INTO magic_links (email, name, token, expires_at) VALUES (?, ?, ?, ?)',
                    [email, name, token, expiresAt],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ lastID: this.lastID });
                    }
                );
            }
        } catch (err) {
            reject(err);
        }
    });
}

export async function findMagicLink(token) {
    if (usePostgres) {
        return await dbGet('SELECT * FROM magic_links WHERE token = $1 AND used = 0', [token]);
    }
    return await dbGet('SELECT * FROM magic_links WHERE token = ? AND used = 0', [token]);
}

export function markMagicLinkAsUsed(token) {
    return new Promise(async (resolve, reject) => {
        try {
            if (usePostgres) {
                await db.pool.query('UPDATE magic_links SET used = 1 WHERE token = $1', [token]);
                resolve();
            } else {
                db.run('UPDATE magic_links SET used = 1 WHERE token = ?', [token], function (err) {
                    if (err) reject(err);
                    else resolve();
                });
            }
        } catch (err) {
            reject(err);
        }
    });
}

export async function cleanupExpiredMagicLinks() {
    return new Promise(async (resolve, reject) => {
        try {
            if (usePostgres) {
                const result = await db.pool.query(
                    "DELETE FROM magic_links WHERE expires_at < NOW() OR used = 1"
                );
                resolve(result.rowCount);
            } else {
                db.run(
                    'DELETE FROM magic_links WHERE expires_at < datetime("now") OR used = 1',
                    function (err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    }
                );
            }
        } catch (err) {
            reject(err);
        }
    });
}

// User profile functions
export async function updateUserProfile(userId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.username !== undefined) {
        fields.push(usePostgres ? `username = $${values.length + 1}` : 'username = ?');
        values.push(updates.username);
    }
    if (updates.profilePicture !== undefined) {
        fields.push(usePostgres ? `profile_picture = $${values.length + 1}` : 'profile_picture = ?');
        values.push(updates.profilePicture);
    }
    
    if (fields.length === 0) {
        return Promise.resolve();
    }
    
    values.push(userId);
    const whereClause = usePostgres ? `$${values.length}` : '?';
    
    return new Promise(async (resolve, reject) => {
        try {
            if (usePostgres) {
                const result = await db.pool.query(
                    `UPDATE users SET ${fields.join(', ')} WHERE id = ${whereClause}`,
                    values
                );
                resolve({ changes: result.rowCount });
            } else {
                db.run(
                    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
                    values,
                    function (err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            }
        } catch (err) {
            reject(err);
        }
    });
}

export async function getUserPreferences(userId) {
    if (usePostgres) {
        return await dbGet('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    }
    return await dbGet('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
}

export function createUserPreferences(userId, preferences = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            if (usePostgres) {
                const result = await db.pool.query(
                    `INSERT INTO user_preferences (
                        user_id, default_microphone, default_camera, default_speaker,
                        notifications_enabled, auto_join_audio, auto_join_video, dark_mode, language
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                    [
                        userId,
                        preferences.defaultMicrophone || null,
                        preferences.defaultCamera || null,
                        preferences.defaultSpeaker || null,
                        preferences.notificationsEnabled !== undefined ? preferences.notificationsEnabled : 1,
                        preferences.autoJoinAudio !== undefined ? preferences.autoJoinAudio : 1,
                        preferences.autoJoinVideo !== undefined ? preferences.autoJoinVideo : 1,
                        preferences.darkMode !== undefined ? (preferences.darkMode ? 1 : 0) : 0,
                        preferences.language || 'en'
                    ]
                );
                resolve({ lastID: result.rows[0].id });
            } else {
                db.run(
                    `INSERT INTO user_preferences (
                        user_id, default_microphone, default_camera, default_speaker,
                        notifications_enabled, auto_join_audio, auto_join_video, dark_mode, language
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        preferences.defaultMicrophone || null,
                        preferences.defaultCamera || null,
                        preferences.defaultSpeaker || null,
                        preferences.notificationsEnabled !== undefined ? preferences.notificationsEnabled : 1,
                        preferences.autoJoinAudio !== undefined ? preferences.autoJoinAudio : 1,
                        preferences.autoJoinVideo !== undefined ? preferences.autoJoinVideo : 1,
                        preferences.darkMode !== undefined ? (preferences.darkMode ? 1 : 0) : 0,
                        preferences.language || 'en'
                    ],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ lastID: this.lastID });
                    }
                );
            }
        } catch (err) {
            reject(err);
        }
    });
}

export async function updateUserPreferences(userId, preferences) {
    const fields = [];
    const values = [];
    
    if (preferences.defaultMicrophone !== undefined) {
        fields.push(usePostgres ? `default_microphone = $${values.length + 1}` : 'default_microphone = ?');
        values.push(preferences.defaultMicrophone);
    }
    if (preferences.defaultCamera !== undefined) {
        fields.push(usePostgres ? `default_camera = $${values.length + 1}` : 'default_camera = ?');
        values.push(preferences.defaultCamera);
    }
    if (preferences.defaultSpeaker !== undefined) {
        fields.push(usePostgres ? `default_speaker = $${values.length + 1}` : 'default_speaker = ?');
        values.push(preferences.defaultSpeaker);
    }
    if (preferences.notificationsEnabled !== undefined) {
        fields.push(usePostgres ? `notifications_enabled = $${values.length + 1}` : 'notifications_enabled = ?');
        values.push(preferences.notificationsEnabled ? 1 : 0);
    }
    if (preferences.autoJoinAudio !== undefined) {
        fields.push(usePostgres ? `auto_join_audio = $${values.length + 1}` : 'auto_join_audio = ?');
        values.push(preferences.autoJoinAudio ? 1 : 0);
    }
    if (preferences.autoJoinVideo !== undefined) {
        fields.push(usePostgres ? `auto_join_video = $${values.length + 1}` : 'auto_join_video = ?');
        values.push(preferences.autoJoinVideo ? 1 : 0);
    }
    if (preferences.darkMode !== undefined) {
        fields.push(usePostgres ? `dark_mode = $${values.length + 1}` : 'dark_mode = ?');
        values.push(preferences.darkMode ? 1 : 0);
    }
    if (preferences.language !== undefined) {
        fields.push(usePostgres ? `language = $${values.length + 1}` : 'language = ?');
        values.push(preferences.language);
    }
    
    if (fields.length === 0) {
        return Promise.resolve();
    }
    
    if (usePostgres) {
        fields.push(`updated_at = NOW()`);
    } else {
        fields.push('updated_at = CURRENT_TIMESTAMP');
    }
    
    values.push(userId);
    const whereClause = usePostgres ? `$${values.length}` : '?';
    
    return new Promise(async (resolve, reject) => {
        try {
            if (usePostgres) {
                const result = await db.pool.query(
                    `UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = ${whereClause}`,
                    values
                );
                resolve({ changes: result.rowCount });
            } else {
                db.run(
                    `UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = ?`,
                    values,
                    function (err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            }
        } catch (err) {
            reject(err);
        }
    });
}

export default db;
