/**
 * Contest Routes
 * 
 * All contest-related REST API endpoints.
 */

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { contestRateLimit } from '../middleware/rateLimit.middleware.js';
import {
  createContest,
  listContests,
  getContest,
  registerForContest,
  unregisterFromContest,
  submitContestCode,
  getContestLeaderboard,
  getMySubmissions,
  startContest,
  endContest,
  getContestStandings,
  getContestQueueStats,
  joinByCode,
} from '../controllers/contest.controller.js';

const router = Router();

// ── Public / List ────────────────────────────────────────────────────
router.get('/', authenticateToken, listContests);
router.get('/queue-stats', authenticateToken, getContestQueueStats);

// ── Join by code ─────────────────────────────────────────────────────
router.post('/join', authenticateToken, joinByCode);

// ── Contest CRUD ─────────────────────────────────────────────────────
router.post('/', authenticateToken, requireAdmin, createContest);
router.get('/:id', authenticateToken, getContest);

// ── Registration ─────────────────────────────────────────────────────
router.post('/:id/register', authenticateToken, registerForContest);
router.delete('/:id/register', authenticateToken, unregisterFromContest);

// ── Submissions (rate limited: 1 per 10 seconds) ────────────────────
router.post('/:id/submit', authenticateToken, contestRateLimit(10), submitContestCode);

// ── Leaderboard & Standings ──────────────────────────────────────────
router.get('/:id/leaderboard', authenticateToken, getContestLeaderboard);
router.get('/:id/standings', authenticateToken, getContestStandings);

// ── User's submissions ───────────────────────────────────────────────
router.get('/:id/submissions', authenticateToken, getMySubmissions);

// ── Admin: Start/End ─────────────────────────────────────────────────
router.post('/:id/start', authenticateToken, requireAdmin, startContest);
router.post('/:id/end', authenticateToken, requireAdmin, endContest);

export default router;
