import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new sqlite3.Database(join(__dirname, 'sweetteams.db'));

// Promisify database methods
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      profile_picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Migration: Add profile_picture column if it doesn't exist
    db.all("PRAGMA table_info(users)", [], (err, columns) => {
        if (err) {
            console.error('Error checking users table:', err);
            return;
        }
        
        const hasProfilePicture = columns.some(col => col.name === 'profile_picture');
        
        if (!hasProfilePicture) {
            db.run('ALTER TABLE users ADD COLUMN profile_picture TEXT', (err) => {
                if (err) {
                    console.error('Error adding profile_picture column:', err);
                } else {
                    console.log('✅ Added profile_picture column to users table');
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

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
});

// Ensure dev user exists for development mode
export function ensureDevUser() {
    return new Promise((resolve, reject) => {
        if (process.env.NODE_ENV !== 'development') {
            resolve();
            return;
        }
        
        db.run(`
            INSERT OR IGNORE INTO users (id, username, email, password_hash)
            VALUES (999999, 'SweetTeams-Dev', 'dev@localhost', '')
        `, (err) => {
            if (err) {
                console.error('❌ Error creating dev user:', err);
                reject(err);
            } else {
                console.log('✅ Dev user ready');
                resolve();
            }
        });
    });
}

// Database functions
export function createUser(username, email, passwordHash = null) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash || ''],
            function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID });
            }
        );
    });
}

export async function findUserByEmail(email) {
    return await dbGet('SELECT * FROM users WHERE email = ?', [email]);
}

export async function findUserByUsername(username) {
    return await dbGet('SELECT * FROM users WHERE username = ?', [username]);
}

export async function findUserById(id) {
    return await dbGet('SELECT id, username, email, profile_picture, created_at FROM users WHERE id = ?', [id]);
}

export function createRoom(name, creatorId, linkCode) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO rooms (name, creator_id, link_code) VALUES (?, ?, ?)',
            [name, creatorId, linkCode],
            function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID });
            }
        );
    });
}

export async function findRoomByLinkCode(linkCode) {
    return await dbGet(
        `SELECT r.*, u.username as creator_username
     FROM rooms r
     JOIN users u ON r.creator_id = u.id
     WHERE r.link_code = ?`,
        [linkCode]
    );
}

export async function findRoomsByCreator(creatorId) {
    return await dbAll(
        'SELECT * FROM rooms WHERE creator_id = ? ORDER BY created_at DESC',
        [creatorId]
    );
}

export function addRoomParticipant(roomId, userId) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR IGNORE INTO room_participants (room_id, user_id) VALUES (?, ?)',
            [roomId, userId],
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

export async function getRoomParticipants(roomId) {
    return await dbAll(
        `SELECT u.id, u.username, rp.joined_at
     FROM room_participants rp
     JOIN users u ON rp.user_id = u.id
     WHERE rp.room_id = ?
     ORDER BY rp.joined_at`,
        [roomId]
    );
}

// Helper to remove room and its participants
export function deleteRoom(linkCodeOrId) {
    return new Promise((resolve, reject) => {
        // Determine if input is ID (number) or LinkCode (string)
        const isId = typeof linkCodeOrId === 'number';
        const query = isId ? 'DELETE FROM rooms WHERE id = ?' : 'DELETE FROM rooms WHERE link_code = ?';

        // First delete participants
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
    });
}

// Magic link functions
export function createMagicLink(email, name, token, expiresAt) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO magic_links (email, name, token, expires_at) VALUES (?, ?, ?, ?)',
            [email, name, token, expiresAt],
            function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID });
            }
        );
    });
}

export async function findMagicLink(token) {
    return await dbGet('SELECT * FROM magic_links WHERE token = ? AND used = 0', [token]);
}

export function markMagicLinkAsUsed(token) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE magic_links SET used = 1 WHERE token = ?',
            [token],
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

export async function cleanupExpiredMagicLinks() {
    return new Promise((resolve, reject) => {
        db.run(
            'DELETE FROM magic_links WHERE expires_at < datetime("now") OR used = 1',
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

// User profile functions
export async function updateUserProfile(userId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.username !== undefined) {
        fields.push('username = ?');
        values.push(updates.username);
    }
    if (updates.profilePicture !== undefined) {
        fields.push('profile_picture = ?');
        values.push(updates.profilePicture);
    }
    
    if (fields.length === 0) {
        return Promise.resolve();
    }
    
    values.push(userId);
    
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values,
            function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            }
        );
    });
}

export async function getUserPreferences(userId) {
    return await dbGet('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
}

export function createUserPreferences(userId, preferences = {}) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO user_preferences (
                user_id, default_microphone, default_camera, default_speaker,
                notifications_enabled, auto_join_audio, auto_join_video
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                preferences.defaultMicrophone || null,
                preferences.defaultCamera || null,
                preferences.defaultSpeaker || null,
                preferences.notificationsEnabled !== undefined ? preferences.notificationsEnabled : 1,
                preferences.autoJoinAudio !== undefined ? preferences.autoJoinAudio : 1,
                preferences.autoJoinVideo !== undefined ? preferences.autoJoinVideo : 1
            ],
            function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID });
            }
        );
    });
}

export async function updateUserPreferences(userId, preferences) {
    const fields = [];
    const values = [];
    
    if (preferences.defaultMicrophone !== undefined) {
        fields.push('default_microphone = ?');
        values.push(preferences.defaultMicrophone);
    }
    if (preferences.defaultCamera !== undefined) {
        fields.push('default_camera = ?');
        values.push(preferences.defaultCamera);
    }
    if (preferences.defaultSpeaker !== undefined) {
        fields.push('default_speaker = ?');
        values.push(preferences.defaultSpeaker);
    }
    if (preferences.notificationsEnabled !== undefined) {
        fields.push('notifications_enabled = ?');
        values.push(preferences.notificationsEnabled ? 1 : 0);
    }
    if (preferences.autoJoinAudio !== undefined) {
        fields.push('auto_join_audio = ?');
        values.push(preferences.autoJoinAudio ? 1 : 0);
    }
    if (preferences.autoJoinVideo !== undefined) {
        fields.push('auto_join_video = ?');
        values.push(preferences.autoJoinVideo ? 1 : 0);
    }
    
    if (fields.length === 0) {
        return Promise.resolve();
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = ?`,
            values,
            function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            }
        );
    });
}

export default db;
