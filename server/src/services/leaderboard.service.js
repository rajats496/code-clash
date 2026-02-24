/**
 * Leaderboard Service (Redis Sorted Sets)
 * 
 * Real-time contest leaderboard using Redis for O(log N) ranking.
 * 
 * Scoring strategies:
 * - ICPC: Primary key = solved count (DESC), secondary = penalty time (ASC)
 * - LeetCode: Primary key = points (DESC), secondary = finish time (ASC)
 * 
 * Redis key pattern: leaderboard:{contestId}
 * Score encoding: solved * 1e10 - penalty (so higher score = better rank)
 */

import { getRedisClient } from '../config/redis.js';

const LEADERBOARD_PREFIX = 'leaderboard';
const LEADERBOARD_DATA_PREFIX = 'lb-data';
const LEADERBOARD_TTL = 86400 * 7; // 7 days

// ─────────────────────────────────────────────
//  Score encoding
// ─────────────────────────────────────────────

/**
 * Encode solved count + penalty into a single Redis score.
 * Higher score = better rank.
 * 
 * ICPC:    score = solved * 1e10 - penalty_seconds
 * LeetCode: score = points * 1e10 - finish_time_seconds
 */
const encodeScore = ({ solved, penalty, points, scoringType }) => {
  if (scoringType === 'leetcode') {
    // Points-based: more points = better, earlier finish = better
    return (points || 0) * 1e10 - (penalty || 0);
  }
  // ICPC: more solved = better, less penalty = better
  return (solved || 0) * 1e10 - (penalty || 0);
};

/**
 * Decode Redis score back to human-readable values
 */
const decodeScore = (score, scoringType) => {
  if (scoringType === 'leetcode') {
    const points = Math.floor(score / 1e10);
    const finishTime = Math.abs(score % 1e10);
    return { points, finishTime: Math.round(finishTime) };
  }
  const solved = Math.floor(score / 1e10);
  const penalty = Math.abs(score % 1e10);
  return { solved, penalty: Math.round(penalty) };
};

// ─────────────────────────────────────────────
//  Key helpers
// ─────────────────────────────────────────────
const leaderboardKey = (contestId) => `${LEADERBOARD_PREFIX}:${contestId}`;
const dataKey = (contestId) => `${LEADERBOARD_DATA_PREFIX}:${contestId}`;

// ─────────────────────────────────────────────
//  Update leaderboard
// ─────────────────────────────────────────────

/**
 * Update a user's leaderboard entry.
 * Called after each accepted submission.
 */
export const updateLeaderboard = async (contestId, userId, {
  solved, penalty, points, scoringType,
}) => {
  const redis = getRedisClient();
  const key = leaderboardKey(contestId);
  const dKey = dataKey(contestId);

  const score = encodeScore({ solved, penalty, points, scoringType });

  // Use pipeline for atomic update
  const pipeline = redis.pipeline();

  // Update sorted set (score → userId)
  pipeline.zadd(key, score, userId.toString());

  // Store detailed data in a hash
  pipeline.hset(dKey, userId.toString(), JSON.stringify({
    solved,
    penalty,
    points,
    lastUpdate: Date.now(),
  }));

  // Set TTL
  pipeline.expire(key, LEADERBOARD_TTL);
  pipeline.expire(dKey, LEADERBOARD_TTL);

  await pipeline.exec();
};

// ─────────────────────────────────────────────
//  Get leaderboard rankings
// ─────────────────────────────────────────────

/**
 * Get full leaderboard for a contest.
 * Returns array of { userId, rank, score, solved, penalty, points }
 * sorted by rank (best first).
 * 
 * @param {string} contestId 
 * @param {string} scoringType - 'icpc' or 'leetcode'
 * @param {number} offset - Starting position (for pagination)
 * @param {number} limit - Number of entries to return
 */
export const getLeaderboard = async (contestId, scoringType = 'icpc', offset = 0, limit = 100) => {
  const redis = getRedisClient();
  const key = leaderboardKey(contestId);
  const dKey = dataKey(contestId);

  // ZREVRANGE: highest score first (best rank)
  const entries = await redis.zrevrange(key, offset, offset + limit - 1, 'WITHSCORES');

  if (!entries || entries.length === 0) return [];

  // Parse entries (alternating userId, score)
  const results = [];
  for (let i = 0; i < entries.length; i += 2) {
    const userId = entries[i];
    const score = parseFloat(entries[i + 1]);
    const decoded = decodeScore(score, scoringType);

    results.push({
      userId,
      rank: offset + (i / 2) + 1,
      score,
      ...decoded,
    });
  }

  // Fetch detailed data
  if (results.length > 0) {
    const userIds = results.map((r) => r.userId);
    const detailedData = await redis.hmget(dKey, ...userIds);

    results.forEach((entry, idx) => {
      if (detailedData[idx]) {
        const data = JSON.parse(detailedData[idx]);
        entry.solved = data.solved;
        entry.penalty = data.penalty;
        entry.points = data.points;
      }
    });
  }

  return results;
};

/**
 * Get a specific user's rank in the contest.
 */
export const getUserRank = async (contestId, userId) => {
  const redis = getRedisClient();
  const key = leaderboardKey(contestId);

  // ZREVRANK: 0-based rank from top
  const rank = await redis.zrevrank(key, userId.toString());
  if (rank === null) return null;

  const score = await redis.zscore(key, userId.toString());

  return {
    rank: rank + 1, // 1-based
    score: parseFloat(score),
  };
};

/**
 * Get total number of participants on the leaderboard.
 */
export const getLeaderboardSize = async (contestId) => {
  const redis = getRedisClient();
  return redis.zcard(leaderboardKey(contestId));
};

// ─────────────────────────────────────────────
//  Initialize leaderboard for a contest
// ─────────────────────────────────────────────

/**
 * Pre-populate leaderboard with all registered participants (score = 0).
 * Called when contest starts.
 */
export const initLeaderboard = async (contestId, participantUserIds) => {
  const redis = getRedisClient();
  const key = leaderboardKey(contestId);
  const dKey = dataKey(contestId);

  const pipeline = redis.pipeline();

  for (const userId of participantUserIds) {
    pipeline.zadd(key, 0, userId.toString());
    pipeline.hset(dKey, userId.toString(), JSON.stringify({
      solved: 0,
      penalty: 0,
      points: 0,
      lastUpdate: Date.now(),
    }));
  }

  pipeline.expire(key, LEADERBOARD_TTL);
  pipeline.expire(dKey, LEADERBOARD_TTL);

  await pipeline.exec();
  console.log(`✅ Leaderboard initialized for contest ${contestId} with ${participantUserIds.length} participants`);
};

// ─────────────────────────────────────────────
//  Cleanup
// ─────────────────────────────────────────────

/**
 * Delete leaderboard data (after contest results are persisted to MongoDB).
 */
export const deleteLeaderboard = async (contestId) => {
  const redis = getRedisClient();
  await redis.del(leaderboardKey(contestId), dataKey(contestId));
};

export default {
  updateLeaderboard,
  getLeaderboard,
  getUserRank,
  getLeaderboardSize,
  initLeaderboard,
  deleteLeaderboard,
};
