import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import { 
    findUserById, 
    updateUserProfile,
    getUserPreferences,
    createUserPreferences,
    updateUserPreferences
} from '../database.js';
import { authenticateToken } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'profiles');
await fs.mkdir(uploadsDir, { recursive: true });

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // Guests don't have profiles
        if (req.user.isGuest) {
            return res.status(403).json({ error: 'Guests do not have profiles' });
        }
        
        const user = await findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let preferences = await getUserPreferences(req.user.id);
        
        // Create default preferences if they don't exist
        if (!preferences) {
            await createUserPreferences(req.user.id);
            preferences = await getUserPreferences(req.user.id);
        }

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                profilePicture: user.profile_picture,
                createdAt: user.created_at
            },
            preferences: {
                defaultMicrophone: preferences.default_microphone,
                defaultCamera: preferences.default_camera,
                defaultSpeaker: preferences.default_speaker,
                notificationsEnabled: Boolean(preferences.notifications_enabled),
                autoJoinAudio: Boolean(preferences.auto_join_audio),
                autoJoinVideo: Boolean(preferences.auto_join_video),
                darkMode: Boolean(preferences.dark_mode)
            }
        });
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update user profile (username)
router.patch('/me', authenticateToken, async (req, res) => {
    try {
        // Guests cannot update profiles
        if (req.user.isGuest) {
            return res.status(403).json({ error: 'Guests cannot update profiles' });
        }
        
        const { username } = req.body;
        const updates = {};

        if (username !== undefined) {
            if (!username || username.trim().length < 2) {
                return res.status(400).json({ error: 'Username must be at least 2 characters' });
            }
            updates.username = username.trim();
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        await updateUserProfile(req.user.id, updates);

        const updatedUser = await findUserById(req.user.id);
        res.json({
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                profilePicture: updatedUser.profile_picture
            }
        });
    } catch (err) {
        console.error('Error updating profile:', err);
        if (err.code === 'SQLITE_CONSTRAINT') {
            res.status(400).json({ error: 'Username already taken' });
        } else {
            res.status(500).json({ error: 'Failed to update profile' });
        }
    }
});

// Upload profile picture
router.post('/me/picture', authenticateToken, upload.single('profilePicture'), async (req, res) => {
    try {
        // Guests cannot upload profile pictures
        if (req.user.isGuest) {
            return res.status(403).json({ error: 'Guests cannot upload profile pictures' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Delete old profile picture if it exists
        const user = await findUserById(req.user.id);
        if (user.profile_picture) {
            const oldPath = path.join(__dirname, '..', user.profile_picture);
            try {
                await fs.unlink(oldPath);
            } catch (err) {
                console.error('Error deleting old profile picture:', err);
            }
        }

        // Save relative path
        const relativePath = `/uploads/profiles/${req.file.filename}`;
        await updateUserProfile(req.user.id, { profilePicture: relativePath });

        res.json({
            profilePicture: relativePath,
            message: 'Profile picture updated successfully'
        });
    } catch (err) {
        console.error('Error uploading profile picture:', err);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});

// Delete profile picture
router.delete('/me/picture', authenticateToken, async (req, res) => {
    try {
        // Guests cannot delete profile pictures
        if (req.user.isGuest) {
            return res.status(403).json({ error: 'Guests do not have profile pictures' });
        }
        
        const user = await findUserById(req.user.id);
        
        if (user.profile_picture) {
            const oldPath = path.join(__dirname, '..', user.profile_picture);
            try {
                await fs.unlink(oldPath);
            } catch (err) {
                console.error('Error deleting profile picture:', err);
            }
        }

        await updateUserProfile(req.user.id, { profilePicture: null });

        res.json({ message: 'Profile picture deleted successfully' });
    } catch (err) {
        console.error('Error deleting profile picture:', err);
        res.status(500).json({ error: 'Failed to delete profile picture' });
    }
});

// Get user preferences
router.get('/preferences', authenticateToken, async (req, res) => {
    try {
        // Guests don't have saved preferences - return defaults
        if (req.user.isGuest) {
            return res.json({
                defaultMicrophone: null,
                defaultCamera: null,
                defaultSpeaker: null,
                notificationsEnabled: true,
                autoJoinAudio: true,
                autoJoinVideo: true,
                darkMode: false
            });
        }
        
        let preferences = await getUserPreferences(req.user.id);
        
        // Create default preferences if they don't exist
        if (!preferences) {
            await createUserPreferences(req.user.id);
            preferences = await getUserPreferences(req.user.id);
        }

        res.json({
            defaultMicrophone: preferences.default_microphone,
            defaultCamera: preferences.default_camera,
            defaultSpeaker: preferences.default_speaker,
            notificationsEnabled: Boolean(preferences.notifications_enabled),
            autoJoinAudio: Boolean(preferences.auto_join_audio),
            autoJoinVideo: Boolean(preferences.auto_join_video),
            darkMode: Boolean(preferences.dark_mode)
        });
    } catch (err) {
        console.error('Error fetching preferences:', err);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
});

// Update user preferences
router.patch('/preferences', authenticateToken, async (req, res) => {
    try {
        // Guests cannot have saved preferences
        if (req.user.isGuest) {
            return res.status(403).json({ error: 'Guests cannot save preferences' });
        }
        
        const {
            defaultMicrophone,
            defaultCamera,
            defaultSpeaker,
            notificationsEnabled,
            autoJoinAudio,
            autoJoinVideo,
            darkMode
        } = req.body;

        // Check if preferences exist, create if not
        let preferences = await getUserPreferences(req.user.id);
        if (!preferences) {
            await createUserPreferences(req.user.id, req.body);
        } else {
            await updateUserPreferences(req.user.id, req.body);
        }

        preferences = await getUserPreferences(req.user.id);
        res.json({
            defaultMicrophone: preferences.default_microphone,
            defaultCamera: preferences.default_camera,
            defaultSpeaker: preferences.default_speaker,
            notificationsEnabled: Boolean(preferences.notifications_enabled),
            autoJoinAudio: Boolean(preferences.auto_join_audio),
            autoJoinVideo: Boolean(preferences.auto_join_video),
            darkMode: Boolean(preferences.dark_mode)
        });
    } catch (err) {
        console.error('Error updating preferences:', err);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

export default router;
