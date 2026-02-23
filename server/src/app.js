import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import testRoutes from './routes/test.routes.js';
import matchRoutes from './routes/match.routes.js';
import userRoutes from './routes/user.routes.js';
import problemRoutes from './routes/problem.routes.js';

const app = express();



// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3003',
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

console.log('✅ Routes registered: /api/auth, /api/test, /api/matches, /api/users, /api/problems');

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