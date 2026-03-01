/**
 * Contest Socket Handler
 * 
 * Real-time WebSocket events for contest mode:
 * - Join/leave contest room
 * - Submit code via socket (alternative to REST)
 * - Receive real-time leaderboard updates
 * - Contest timer synchronization
 * - Live participant count
 */

import { Contest } from '../models/Contest.model.js';
import { ContestSubmission } from '../models/ContestSubmission.model.js';
import { addSubmission } from '../services/queue.service.js';
import { getLeaderboard, getUserRank } from '../services/leaderboard.service.js';
import { checkSocketRateLimit } from '../middleware/rateLimit.middleware.js';
import { getRedisClient } from '../config/redis.js';

const CONTEST_CACHE_PREFIX = 'contest';
const CONTEST_CACHE_TTL_SEC = 60;

// Track active contest timers
const contestTimers = new Map();

async function getContestForJoin(contestId) {
  const redis = getRedisClient();
  const key = `${CONTEST_CACHE_PREFIX}:${contestId}`;
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const contest = await Contest.findById(contestId)
    .select('status startTime endTime duration problems participants')
    .lean();
  if (!contest) return null;

  const forCache = {
    ...contest,
    startTime: contest.startTime?.toISO?.() ?? contest.startTime,
    endTime: contest.endTime?.toISO?.() ?? contest.endTime,
    participants: (contest.participants || []).map((p) => ({
      ...p,
      user: p.user?.toString?.() ?? p.user,
    })),
  };
  try {
    await redis.setex(key, CONTEST_CACHE_TTL_SEC, JSON.stringify(forCache));
  } catch (e) {}
  return forCache;
}

// ─────────────────────────────────────────────
//  Join Contest Room (Redis-cached to survive 500-user spike)
// ─────────────────────────────────────────────
export const handleJoinContest = (io, socket) => {
  socket.on('join-contest', async ({ contestId }) => {
    try {
      const userId = socket.user._id.toString();

      const contest = await getContestForJoin(contestId);
      if (!contest) {
        return socket.emit('contest-error', { message: 'Contest not found' });
      }

      const userStr = (u) => (u && (typeof u === 'string' ? u : u.toString?.())) || '';
      const isRegistered = contest.participants?.some((p) => userStr(p.user) === userId);
      if (!isRegistered) {
        return socket.emit('contest-error', { message: 'Not registered for this contest' });
      }

      const room = `contest-${contestId}`;
      socket.join(room);

      const roomSockets = await io.in(room).fetchSockets();
      const participantsOnline = roomSockets.length;

      console.log(`🏆 ${socket.user.name} joined contest room ${contestId} (${participantsOnline} online)`);

      socket.emit('contest-joined', {
        contestId,
        status: contest.status,
        startTime: contest.startTime,
        endTime: contest.endTime,
        duration: contest.duration,
        problemCount: (contest.problems || []).length,
        participantsOnline,
        totalParticipants: (contest.participants || []).length,
      });

      socket.to(room).emit('contest-participant-online', {
        userId,
        name: socket.user.name,
        participantsOnline,
      });

      if (contest.status === 'active') {
        startContestTimer(io, contestId, contest.startTime, contest.endTime);
      }
    } catch (err) {
      console.error('❌ Join contest error:', err.message);
      socket.emit('contest-error', { message: 'Failed to join contest' });
    }
  });
};

// ─────────────────────────────────────────────
//  Leave Contest Room
// ─────────────────────────────────────────────
export const handleLeaveContest = (io, socket) => {
  socket.on('leave-contest', ({ contestId }) => {
    const room = `contest-${contestId}`;
    socket.leave(room);

    socket.to(room).emit('contest-participant-offline', {
      userId: socket.user._id.toString(),
      name: socket.user.name,
    });

    console.log(`🚪 ${socket.user.name} left contest room ${contestId}`);
  });
};

// ─────────────────────────────────────────────
//  Submit Code via Socket (alternative to REST API)
// ─────────────────────────────────────────────
export const handleContestSubmit = (io, socket) => {
  socket.on('contest-submit', async ({ contestId, problemId, code, language }) => {
    const userId = socket.user._id.toString();

    try {
      // Validate code size (64 KB max)
      if (!code || typeof code !== 'string' || code.length > 65536) {
        return socket.emit('contest-submission-result', {
          contestId,
          problemId,
          verdict: 'Error',
          error: 'Code too large. Maximum 64 KB allowed.',
        });
      }

      // Rate limit check
      const { limited, retryAfter } = await checkSocketRateLimit(userId, 10);
      if (limited) {
        return socket.emit('contest-submission-result', {
          contestId,
          problemId,
          verdict: 'Rate Limited',
          error: `Please wait ${retryAfter} seconds before submitting again`,
        });
      }

      // Validate contest
      const contest = await Contest.findById(contestId);
      if (!contest || contest.status !== 'active') {
        return socket.emit('contest-submission-result', {
          contestId,
          problemId,
          verdict: 'Error',
          error: 'Contest is not active',
        });
      }

      // Check time
      const now = new Date();
      if (now > contest.endTime) {
        return socket.emit('contest-submission-result', {
          contestId,
          problemId,
          verdict: 'Error',
          error: 'Contest has ended',
        });
      }

      // Check registration
      if (!contest.isUserRegistered(userId)) {
        return socket.emit('contest-submission-result', {
          contestId,
          problemId,
          verdict: 'Error',
          error: 'Not registered for this contest',
        });
      }

      // Check if already solved
      const participant = contest.getParticipant(userId);
      const pStatus = participant?.problemStatus?.find(
        (ps) => ps.problem.toString() === problemId
      );
      if (pStatus?.solved) {
        return socket.emit('contest-submission-result', {
          contestId,
          problemId,
          verdict: 'Info',
          error: 'Problem already solved',
        });
      }

      // Calculate contest time
      const contestTime = Math.floor((now - contest.startTime) / 1000);

      // Create submission
      const submission = new ContestSubmission({
        contest: contestId,
        user: userId,
        problem: problemId,
        code,
        language,
        status: 'queued',
        contestTime,
        submittedAt: now,
      });
      await submission.save();

      // ACK to user immediately
      socket.emit('contest-submission-queued', {
        contestId,
        problemId,
        submissionId: submission._id,
        message: 'Submission queued for judging',
      });

      // Add to processing queue
      await addSubmission({
        submissionId: submission._id.toString(),
        contestId,
        userId,
        problemId,
        sourceCode: code,
        languageId: language,
        contestTime,
      });

      console.log(`📩 Contest socket submission: ${submission._id}`);

    } catch (err) {
      console.error('❌ Contest socket submit error:', err.message);
      socket.emit('contest-submission-result', {
        contestId,
        problemId,
        verdict: 'Internal Error',
        error: 'Failed to submit code',
      });
    }
  });
};

// ─────────────────────────────────────────────
//  Request leaderboard via socket
// ─────────────────────────────────────────────
export const handleContestLeaderboard = (io, socket) => {
  socket.on('contest-get-leaderboard', async ({ contestId, page = 1, limit = 50 }) => {
    try {
      const contest = await Contest.findById(contestId).lean();
      if (!contest) return;

      const offset = (page - 1) * limit;
      const entries = await getLeaderboard(contestId, contest.scoringType, offset, limit);

      // Get user's own rank
      const myRank = await getUserRank(contestId, socket.user._id.toString());

      socket.emit('contest-leaderboard-data', {
        contestId,
        leaderboard: entries,
        myRank,
        page,
      });
    } catch (err) {
      console.error('❌ Socket leaderboard error:', err.message);
    }
  });
};

// ─────────────────────────────────────────────
//  Contest Timer Broadcast
// ─────────────────────────────────────────────
const startContestTimer = (io, contestId, startTime, endTime) => {
  const room = `contest-${contestId}`;

  // Don't start duplicate timers
  if (contestTimers.has(contestId)) return;

  const intervalId = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((new Date(endTime).getTime() - now) / 1000));

    // Clients compute timer locally from contest.endTime; no need to broadcast every 5s
    // io.to(room).emit('contest-timer', { contestId, elapsed, remaining, startTime, endTime });

    // Auto-stop timer when contest ends
    if (remaining <= 0) {
      clearInterval(intervalId);
      contestTimers.delete(contestId);
      io.to(room).emit('contest-time-up', { contestId });
    }
  }, 5000); // Broadcast every 5 seconds (clients calculate locally)

  contestTimers.set(contestId, intervalId);
};

// ─────────────────────────────────────────────
//  Handle disconnect — leave all contest rooms
// ─────────────────────────────────────────────
export const onContestDisconnect = (io, socket) => {
  // Socket.io automatically removes the socket from all rooms on disconnect.
  // We just need to notify other participants.
  const userId = socket.user._id.toString();

  // Get all rooms this socket was in
  for (const room of socket.rooms) {
    if (room.startsWith('contest-')) {
      socket.to(room).emit('contest-participant-offline', {
        userId,
        name: socket.user.name,
      });
    }
  }
};

// ─────────────────────────────────────────────
//  Cleanup (called on server shutdown)
// ─────────────────────────────────────────────
export const cleanupContestTimers = () => {
  for (const [contestId, intervalId] of contestTimers) {
    clearInterval(intervalId);
  }
  contestTimers.clear();
};
