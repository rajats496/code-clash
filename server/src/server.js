import dotenv from 'dotenv';

// ⚠️ CRITICAL: Load .env BEFORE any other imports
dotenv.config();

// Now import everything else
import http from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import { initializeSocket } from './socket/index.js';
import { getRedisClient } from './config/redis.js';
import {
  initSubmissionQueue,
  initQueueEvents,
  closeQueue,
} from './services/queue.service.js';
import { closeRedis } from './config/redis.js';
import { startContestScheduler, stopContestScheduler } from './services/contest-scheduler.service.js';

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    // Initialize Redis + BullMQ for contest submissions
    try {
      getRedisClient(); // Establish Redis connection
      initSubmissionQueue();
      initQueueEvents();
      startContestScheduler();
      console.log('✅ Contest submission queue + scheduler ready');
    } catch (err) {
      console.warn('⚠️ Redis/BullMQ not available — contest features disabled:', err.message);
      console.warn('   Run: docker-compose -f docker-compose.judge0.yml up -d');
    }

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.io ready for connections`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  });

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down gracefully...`);
  try {
    stopContestScheduler();
    await closeQueue();
    await closeRedis();
  } catch (e) { /* ignore */ }
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));