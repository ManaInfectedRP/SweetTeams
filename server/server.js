import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import profileRoutes from './routes/profile.js';
import adminRoutes from './routes/admin.js';
import { setupSignaling } from './signaling.js';
import { ensureDevUser } from './database.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? CLIENT_URL : '*',
    credentials: true
}));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SweetTeams server is running' });
});

// Setup Socket.io signaling
setupSignaling(httpServer);

// Start server
async function startServer() {
    try {
        // Ensure dev user exists before starting
        await ensureDevUser();
        
        httpServer.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 SweetTeams server running on http://localhost:${PORT}`);
            console.log(`📡 WebSocket signaling ready`);
            console.log(`📱 Network access enabled - accessible from other devices`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
