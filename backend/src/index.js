import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import eventRoutes from './routes/events.js';

import { connectDB, testConnection } from './config/database.js';
import { initializeSocket } from './config/socket.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import profileRoutes from './routes/profiles.js';
import matchRoutes from './routes/matches.js';
import chatRoutes from './routes/chat.js';
import notificationRoutes from './routes/notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// CORS origin handling.
// - DEV: accept any origin (localhost, LAN IP, etc.) — nothing to change when
//   moving from localhost to the network or switching IP/wifi.
// - PROD: strict allowlist from CORS_ORIGINS (comma-separated), or FRONTEND_URL.
const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOrigin = (origin, callback) => {
  // No origin = same-origin request, curl, native mobile app... → OK
  if (!origin) return callback(null, true);
  // In dev, reflect the origin (works with credentials, unlike '*')
  if (!isProduction) return callback(null, true);
  // In prod, allowlist
  if (allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
  return callback(new Error('Not allowed by CORS'));
};

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

// Trust the reverse proxy (nginx = single hop) so req.ip is the REAL client IP
// (read from X-Forwarded-For) and not the nginx container IP. Without this, all
// clients share one IP → a single "too many attempts" blocks EVERYONE
// (all users / browsers / machines).
app.set('trust proxy', 1);

// Body parsing BEFORE rate limiting: the auth limiter needs req.body to build a
// per-account key (see keyGenerator below).
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MIN) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development'
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: (parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MIN) || 60) * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Key = real IP + attempted username. On a shared IP (localhost, LAN, NAT),
  // failed attempts on one account no longer lock other accounts/browsers;
  // brute-force protection stays active per (account, IP). ipKeyGenerator handles IPv6.
  keyGenerator: (req) => {
    const username = (req.body?.username || '').toString().trim().toLowerCase();
    return `${ipKeyGenerator(req.ip)}:${username}`;
  },
  message: { error: 'Too many login attempts, please try again after an hour' }
});
app.use('/api/auth/login', authLimiter);

// --- SUPPRESSION DE PASSPORT.INITIALIZE() ---

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus ? 'connected' : 'disconnected'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/events', eventRoutes);

// 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({ error: message });
});

// Initialize socket handlers
initializeSocket(io);

// Make io accessible to routes
app.set('io', io);

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    console.log('✅ Database connected');
    
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();