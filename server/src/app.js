import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import testRoutes from './routes/test.routes.js';
import matchRoutes from './routes/match.routes.js';
import userRoutes from './routes/user.routes.js';
import problemRoutes from './routes/problem.routes.js';
import contestRoutes from './routes/contest.routes.js';
import reportRoutes from './routes/report.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();



// Middleware — allow multiple origins for split hosting (Render frontend + AWS backend)
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3003',
  'http://localhost:5173',
  'https://code-clash-ynj3.onrender.com',
  'https://cclash.duckdns.org',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return callback(null, true);
    }
    console.warn(`⚠️ CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CodeClash API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

console.log('✅ Routes registered: /api/auth, /api/test, /api/matches, /api/users, /api/problems, /api/contests, /api/reports, /api/admin');

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

export default app;