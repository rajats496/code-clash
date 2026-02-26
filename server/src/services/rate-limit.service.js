import { getRedisClient } from '../config/redis.js';

const makeKey = (scope, id) => `rl:${scope}:${id}`;

/**
 * Simple token bucket using Redis INCR + TTL.
 * - maxTokens per windowSeconds.
 * Returns { allowed: boolean, remaining: number, resetAt: number }.
 */
export const consumeToken = async ({ scope, id, maxTokens, windowSeconds }) => {
  const redis = getRedisClient();
  const key = makeKey(scope, id);
  const ttl = windowSeconds;

  const [[, current], [, ttlLeft]] = await redis
    .multi()
    .incr(key)
    .ttl(key)
    .exec();

  let remainingTtl = ttlLeft;

  if (remainingTtl === -1) {
    await redis.expire(key, ttl);
    remainingTtl = ttl;
  }

  const allowed = current <= maxTokens;
  const remaining = Math.max(0, maxTokens - current);
  const resetAt = Date.now() + remainingTtl * 1000;

  return { allowed, remaining, resetAt };
};

