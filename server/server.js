import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import { setupSignaling } from './signaling.js';

// Load environment variables
dotenv.config();

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SweetTeams server is running' });
});

// Setup Socket.io signaling
setupSignaling(httpServer);

// Start server
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SweetTeams server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket signaling ready`);
    console.log(`📱 Network access enabled - accessible from other devices`);
});
