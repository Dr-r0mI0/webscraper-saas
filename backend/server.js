import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './db/init.js';
import authRoutes from './routes/auth.js';
import sitemapRoutes from './routes/sitemaps.js';
import jobRoutes from './routes/jobs.js';
import { scraperEvents } from './services/scraper.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Database
initDatabase();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sitemaps', sitemapRoutes);
app.use('/api/jobs', jobRoutes);

// Serve Frontend Static Files
const frontendPath = process.env.NODE_ENV === 'production'
    ? join(__dirname, 'public')
    : join(__dirname, '../frontend/dist');
console.log('Serving frontend from:', frontendPath);
app.use(express.static(frontendPath));

// Handle React Routing (SPA)
app.get('*', (req, res) => {
    res.sendFile(join(frontendPath, 'index.html'));
});

// Socket.IO for real-time logs
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('subscribe', (jobId) => {
        socket.join(`job:${jobId}`);
    });

    socket.on('unsubscribe', (jobId) => {
        socket.leave(`job:${jobId}`);
    });
});

// Forward scraper events to Socket.IO
scraperEvents.on('log', (logData) => {
    io.to(`job:${logData.jobId}`).emit('log', logData);
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Production Server running on http://0.0.0.0:${PORT}`);
});
