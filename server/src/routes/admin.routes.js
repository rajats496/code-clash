import express from 'express';
import mongoose from 'mongoose';
import { getQueueStats } from '../services/queue.service.js';
import { getRedisClient } from '../config/redis.js';

const router = express.Router();

const requireAdminKey = (req, res, next) => {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) {
    return res.status(503).json({ error: 'Admin health endpoint not configured' });
  }
  const headerKey = req.header('x-admin-key');
  if (!headerKey || headerKey !== configuredKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.get('/health', requireAdminKey, async (req, res) => {
  try {
    const queue = await getQueueStats();

    let redisOk = false;
    let redisLatencyMs = null;
    try {
      const redis = getRedisClient();
      const t0 = Date.now();
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
      redisLatencyMs = Date.now() - t0;
    } catch {
      redisOk = false;
    }

    const mongoState = mongoose.connection.readyState;

    res.json({
      ok: true,
      worker: {
        queue,
        WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY || null,
        CONTEST_PISTON_CONCURRENCY: process.env.CONTEST_PISTON_CONCURRENCY || null,
      },
      redis: {
        ok: redisOk,
        latencyMs: redisLatencyMs,
      },
      mongo: {
        readyState: mongoState,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Admin health error:', err);
    res.status(500).json({ error: 'Failed to fetch health info' });
  }
});

export default router;

