import { PORT, CLIENT_ORIGIN } from './config/env.js';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import setupSocket from './socket/socket.js';
import { apiLimiter } from './middleware/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Derrière un proxy inverse (nginx, Heroku…), définir TRUST_PROXY=1 pour que
// la limitation se base sur la vraie IP du client et non celle du proxy.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

app.use(cors({
  origin: CLIENT_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/Uploads', express.static(path.join(__dirname, 'Uploads'), {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
  },
}));

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/video', videoRoutes);

app.use((err, req, res, next) => {
  console.error('Global error:', err);
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : 'Invalid upload' });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  res.status(500).json({ error: 'Something went wrong' });
});

connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
});

setupSocket(io);
