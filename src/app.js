require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const reservationRoutes = require('./routes/reservationRoutes');

// ─── App Init ──────────────────────────────────────────────────────────────────
const app = express();

// ─── Database ─────────────────────────────────────────────────────────────────
connectDB();

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Global rate limiter: 100 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requêtes. Réessayez dans 15 minutes.',
  },
});
app.use(globalLimiter);

// Strict rate limiter for auth routes: 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  },
});

// ─── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Static Files ──────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/reservations', reservationRoutes);

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API opérationnelle', timestamp: new Date() });
});

// ─── Error Handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Serveur démarré en mode ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 http://localhost:${PORT}\n`);
});

module.exports = app;
