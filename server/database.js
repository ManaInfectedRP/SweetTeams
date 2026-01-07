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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    return await dbGet('SELECT id, username, email, created_at FROM users WHERE id = ?', [id]);
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

export default db;
