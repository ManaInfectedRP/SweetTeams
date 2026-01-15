import express from 'express';
import { authenticateToken, requireAdmin } from './auth.js';
import db from '../database.js';

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// Get database statistics
router.get('/stats', async (req, res) => {
    try {
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        let stats;
        if (usePostgres) {
            const [users, rooms, magicLinks, preferences, guestSessions] = await Promise.all([
                db.pool.query('SELECT COUNT(*) FROM users'),
                db.pool.query('SELECT COUNT(*) FROM rooms'),
                db.pool.query('SELECT COUNT(*) FROM magic_links'),
                db.pool.query('SELECT COUNT(*) FROM user_preferences'),
                db.pool.query("SELECT COUNT(*) FROM guest_sessions WHERE expires_at > NOW()")
            ]);
            
            stats = {
                users: parseInt(users.rows[0].count),
                rooms: parseInt(rooms.rows[0].count),
                magicLinks: parseInt(magicLinks.rows[0].count),
                preferences: parseInt(preferences.rows[0].count),
                guestSessions: parseInt(guestSessions.rows[0].count),
                databaseType: 'PostgreSQL'
            };
        } else {
            stats = await new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM users', [], (err, users) => {
                    if (err) return reject(err);
                    db.get('SELECT COUNT(*) as count FROM rooms', [], (err, rooms) => {
                        if (err) return reject(err);
                        db.get('SELECT COUNT(*) as count FROM magic_links', [], (err, magicLinks) => {
                            if (err) return reject(err);
                            db.get('SELECT COUNT(*) as count FROM user_preferences', [], (err, preferences) => {
                                if (err) return reject(err);
                                db.get('SELECT COUNT(*) as count FROM guest_sessions WHERE expires_at > datetime("now")', [], (err, guestSessions) => {
                                    if (err) return reject(err);
                                    resolve({
                                        users: users.count,
                                        rooms: rooms.count,
                                        magicLinks: magicLinks.count,
                                        preferences: preferences.count,
                                        guestSessions: guestSessions.count,
                                        databaseType: 'SQLite'
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }
        
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        let users;
        if (usePostgres) {
            const result = await db.pool.query(`
                SELECT id, username, email, profile_picture, is_admin, created_at
                FROM users
                ORDER BY created_at DESC
            `);
            users = result.rows;
        } else {
            users = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT id, username, email, profile_picture, is_admin, created_at
                    FROM users
                    ORDER BY created_at DESC
                `, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
        
        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get all guest sessions
router.get('/guests', async (req, res) => {
    try {
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        let guests;
        if (usePostgres) {
            const result = await db.pool.query(`
                SELECT id, guest_name, link_code, created_at, expires_at,
                       CASE WHEN expires_at > NOW() THEN true ELSE false END as is_active
                FROM guest_sessions
                ORDER BY created_at DESC
            `);
            guests = result.rows;
        } else {
            guests = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT id, guest_name, link_code, created_at, expires_at,
                           CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END as is_active
                    FROM guest_sessions
                    ORDER BY created_at DESC
                `, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
        
        res.json({ guests });
    } catch (error) {
        console.error('Error fetching guest sessions:', error);
        res.status(500).json({ error: 'Failed to fetch guest sessions' });
    }
});

// Get all rooms
router.get('/rooms', async (req, res) => {
    try {
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        let rooms;
        if (usePostgres) {
            const result = await db.pool.query(`
                SELECT r.*, u.username as creator_username,
                       (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id) as participant_count
                FROM rooms r
                JOIN users u ON r.creator_id = u.id
                ORDER BY r.created_at DESC
            `);
            rooms = result.rows;
        } else {
            rooms = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT r.*, u.username as creator_username,
                           (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id) as participant_count
                    FROM rooms r
                    JOIN users u ON r.creator_id = u.id
                    ORDER BY r.created_at DESC
                `, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
        
        res.json({ rooms });
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
});

// Update user admin status
router.patch('/users/:userId/admin', async (req, res) => {
    try {
        const { userId } = req.params;
        const { isAdmin } = req.body;
        
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({ error: 'Cannot modify your own admin status' });
        }
        
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        if (usePostgres) {
            await db.pool.query(
                'UPDATE users SET is_admin = $1 WHERE id = $2',
                [isAdmin ? 1 : 0, userId]
            );
        } else {
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET is_admin = ? WHERE id = ?',
                    [isAdmin ? 1 : 0, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
        
        res.json({ message: 'Admin status updated successfully' });
    } catch (error) {
        console.error('Error updating admin status:', error);
        res.status(500).json({ error: 'Failed to update admin status' });
    }
});

// Delete user (admin only)
router.delete('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        if (usePostgres) {
            await db.pool.query('DELETE FROM users WHERE id = $1', [userId]);
        } else {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Delete room (admin only)
router.delete('/rooms/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        if (usePostgres) {
            await db.pool.query('DELETE FROM room_participants WHERE room_id = $1', [roomId]);
            await db.pool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
        } else {
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('DELETE FROM room_participants WHERE room_id = ?', [roomId], (err) => {
                        if (err) console.error('Error deleting participants:', err);
                    });
                    db.run('DELETE FROM rooms WHERE id = ?', [roomId], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        }
        
        res.json({ message: 'Room deleted successfully' });
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).json({ error: 'Failed to delete room' });
    }
});

// Delete guest session (admin only)
router.delete('/guests/:guestId', async (req, res) => {
    try {
        const { guestId } = req.params;
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        if (usePostgres) {
            await db.pool.query('DELETE FROM guest_sessions WHERE id = $1', [guestId]);
        } else {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM guest_sessions WHERE id = ?', [guestId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        
        res.json({ message: 'Guest session deleted successfully' });
    } catch (error) {
        console.error('Error deleting guest session:', error);
        res.status(500).json({ error: 'Failed to delete guest session' });
    }
});

// Clean up expired magic links
router.post('/cleanup/magic-links', async (req, res) => {
    try {
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        let deletedCount;
        if (usePostgres) {
            const result = await db.pool.query(
                "DELETE FROM magic_links WHERE expires_at < NOW() OR used = 1"
            );
            deletedCount = result.rowCount;
        } else {
            deletedCount = await new Promise((resolve, reject) => {
                db.run(
                    'DELETE FROM magic_links WHERE expires_at < datetime("now") OR used = 1',
                    function (err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    }
                );
            });
        }
        
        res.json({ message: `Cleaned up ${deletedCount} expired/used magic links` });
    } catch (error) {
        console.error('Error cleaning up magic links:', error);
        res.status(500).json({ error: 'Failed to clean up magic links' });
    }
});

// Clean up expired guest sessions
router.post('/cleanup/guests', async (req, res) => {
    try {
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        let deletedCount;
        if (usePostgres) {
            const result = await db.pool.query(
                "DELETE FROM guest_sessions WHERE expires_at < NOW()"
            );
            deletedCount = result.rowCount;
        } else {
            deletedCount = await new Promise((resolve, reject) => {
                db.run(
                    'DELETE FROM guest_sessions WHERE expires_at < datetime("now")',
                    function (err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    }
                );
            });
        }
        
        res.json({ message: `Cleaned up ${deletedCount} expired guest sessions` });
    } catch (error) {
        console.error('Error cleaning up guest sessions:', error);
        res.status(500).json({ error: 'Failed to clean up guest sessions' });
    }
});

// Get database info
router.get('/database/info', async (req, res) => {
    try {
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        if (usePostgres) {
            const versionResult = await db.pool.query('SELECT version()');
            const sizeResult = await db.pool.query(`
                SELECT pg_size_pretty(pg_database_size(current_database())) as size
            `);
            
            res.json({
                type: 'PostgreSQL',
                version: versionResult.rows[0].version,
                size: sizeResult.rows[0].size,
                connectionString: process.env.DATABASE_URL ? 'Connected' : 'Not configured'
            });
        } else {
            const fs = await import('fs');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            const { dirname, join } = path;
            
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            const dbPath = join(__dirname, '..', 'sweetteams.db');
            
            const stats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
            
            res.json({
                type: 'SQLite',
                version: 'SQLite 3',
                size: stats ? `${(stats.size / 1024).toFixed(2)} KB` : 'Unknown',
                path: dbPath
            });
        }
    } catch (error) {
        console.error('Error fetching database info:', error);
        res.status(500).json({ error: 'Failed to fetch database info' });
    }
});

export default router;
