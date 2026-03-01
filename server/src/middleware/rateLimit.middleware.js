/**
 * Rate Limiter Middleware
 * 
 * Prevents abuse during contests:
 * - Per-user submission throttle (1 per 10 seconds)
 * - Global request rate limiting
 * 
 * Uses Redis for distributed rate limiting (works across multiple server instances).
 */

import { getRedisClient } from '../config/redis.js';

/**
 * Contest submission rate limiter.
 * Limits each user to 1 submission every `windowSeconds` seconds.
 * 
 * Usage: app.post('/submit', contestRateLimit(10), handler)
 * 
 * @param {number} windowSeconds - Minimum seconds between submissions (default: 10)
 */
export const contestRateLimit = (windowSeconds = 10) => {
  return async (req, res, next) => {
    try {
      const redis = getRedisClient();
      const userId = req.user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const key = `ratelimit:contest-submit:${userId}`;
      const exists = await redis.exists(key);

      if (exists) {
        const ttl = await redis.ttl(key);
        return res.status(429).json({
          error: 'Too many submissions',
          message: `Please wait ${ttl} seconds before submitting again`,
          retryAfter: ttl,
        });
      }

      // Set rate limit key with expiry
      await redis.setex(key, windowSeconds, '1');
      next();
    } catch (err) {
      // If Redis is down, let the request through (fail open)
      console.error('Rate limiter error:', err.message);
      next();
    }
  };
};

/**
 * Socket.io rate limiter for contest submissions.
 * Returns true if the user should be rate-limited (blocked).
 * 
 * @param {string} userId
 * @param {number} windowSeconds
 * @returns {Promise<{limited: boolean, retryAfter: number}>}
 */
export const checkSocketRateLimit = async (userId, windowSeconds = 10) => {
  try {
    const redis = getRedisClient();
    const key = `ratelimit:contest-submit:${userId}`;
    const exists = await redis.exists(key);

    if (exists) {
      const ttl = await redis.ttl(key);
      return { limited: true, retryAfter: ttl };
    }

    await redis.setex(key, windowSeconds, '1');
    return { limited: false, retryAfter: 0 };
  } catch (err) {
    console.error('Socket rate limiter error:', err.message);
    return { limited: false, retryAfter: 0 }; // Fail open
  }
};

/**
 * Generic API rate limiter middleware.
 * Limits requests per user per time window.
 * 
 * @param {number} maxRequests - Max requests in the window
 * @param {number} windowSeconds - Time window in seconds
 */
export const apiRateLimit = (maxRequests = 60, windowSeconds = 60) => {
  return async (req, res, next) => {
    try {
      const redis = getRedisClient();
      const identifier = req.user?._id?.toString() || req.ip;
      const key = `ratelimit:api:${identifier}`;

      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': Math.max(0, maxRequests - current),
        'X-RateLimit-Reset': Math.ceil(Date.now() / 1000) + windowSeconds,
      });

      if (current > maxRequests) {
        const ttl = await redis.ttl(key);
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${ttl} seconds.`,
          retryAfter: ttl,
        });
      }

      next();
    } catch (err) {
      console.error('API rate limiter error:', err.message);
      next(); // Fail open
    }
  };
};

/**
 * Auth rate limiter (login, register, verify-otp, resend-otp).
 * Uses IP; no user yet. Limits requests per IP per window.
 */
export const authRateLimit = (maxRequests = 10, windowSeconds = 900) => {
  return async (req, res, next) => {
    try {
      const redis = getRedisClient();
      const key = `ratelimit:auth:${req.ip}`;

      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, windowSeconds);

      res.set('X-RateLimit-Limit', maxRequests);
      res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

      if (current > maxRequests) {
        const ttl = await redis.ttl(key);
        return res.status(429).json({
          error: 'Too many attempts',
          message: `Please try again in ${ttl} seconds.`,
          retryAfter: ttl,
        });
      }
      next();
    } catch (err) {
      console.error('Auth rate limiter error:', err.message);
      next();
    }
  };
};

export default {
  contestRateLimit,
  checkSocketRateLimit,
  apiRateLimit,
  authRateLimit,
};
