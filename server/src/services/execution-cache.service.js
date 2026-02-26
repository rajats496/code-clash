import crypto from 'crypto';
import { getRedisClient } from '../config/redis.js';

const CACHE_TTL_SECONDS = parseInt(process.env.EXEC_CACHE_TTL_SECONDS || '60', 10);

const makeKey = ({ problemId, languageId, code, visibleOnly }) => {
  const hash = crypto.createHash('sha1').update(code).digest('hex');
  return `execCache:${problemId}:${languageId}:${visibleOnly ? 'vis' : 'all'}:${hash}`;
};

export const getCachedResult = async ({ problemId, languageId, code, visibleOnly }) => {
  const redis = getRedisClient();
  const key = makeKey({ problemId, languageId, code, visibleOnly });
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : null;
};

export const setCachedResult = async ({ problemId, languageId, code, visibleOnly, result }) => {
  const redis = getRedisClient();
  const key = makeKey({ problemId, languageId, code, visibleOnly });
  await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(result));
};

