/**
 * Contest Controller
 * 
 * Handles all contest REST API endpoints:
 * - Create, list, get contest details
 * - Register/unregister for contests
 * - Submit code (queued via BullMQ)
 * - Get leaderboard & standings
 * - Admin: start/end contests
 */

import { Contest } from '../models/Contest.model.js';
import { ContestSubmission } from '../models/ContestSubmission.model.js';
import { Problem } from '../models/Problem.model.js';
import { User } from '../models/User.model.js';
import { addSubmission, getQueueStats } from '../services/queue.service.js';
import {
  getLeaderboard,
  getUserRank,
  getLeaderboardSize,
  initLeaderboard,
} from '../services/leaderboard.service.js';
import { finalizeContest } from '../services/contest-scheduler.service.js';
import { getIO } from '../socket/index.js';

const MAX_CODE_SIZE = 64 * 1024; // 64 KB max code size

// ─────────────────────────────────────────────
//  Helper: Generate contest code
// ─────────────────────────────────────────────
const generateContestCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// ─────────────────────────────────────────────
//  POST /api/contests — Create a contest
// ─────────────────────────────────────────────
export const createContest = async (req, res) => {
  try {
    const {
      title,
      description,
      problemIds,     // Array of problem ObjectIds
      startTime,
      duration,       // In minutes
      scoringType,    // 'icpc' or 'leetcode'
      isPublic,
      maxParticipants,
      wrongSubmissionPenalty,
    } = req.body;

    // Validate
    if (!title || !problemIds?.length || !startTime || !duration) {
      return res.status(400).json({
        error: 'Missing required fields: title, problemIds, startTime, duration',
      });
    }

    if (duration < 10 || duration > 300) {
      return res.status(400).json({ error: 'Duration must be 10-300 minutes' });
    }

    if (problemIds.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 problems per contest' });
    }

    // Verify all problems exist
    const problems = await Problem.find({ _id: { $in: problemIds } });
    if (problems.length !== problemIds.length) {
      return res.status(400).json({ error: 'One or more problems not found' });
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    if (start < new Date()) {
      return res.status(400).json({ error: 'Start time must be in the future' });
    }

    // Build problems array with order and points
    const contestProblems = problemIds.map((id, idx) => ({
      problem: id,
      order: idx + 1,
      points: getPointsForProblem(problems.find((p) => p._id.toString() === id), idx),
    }));

    const contest = new Contest({
      title,
      description: description || '',
      code: generateContestCode(),
      problems: contestProblems,
      startTime: start,
      endTime: end,
      duration,
      scoringType: scoringType || 'icpc',
      isPublic: isPublic !== false,
      maxParticipants: maxParticipants || 1000,
      wrongSubmissionPenalty: wrongSubmissionPenalty || 20,
      createdBy: req.user._id,
      status: 'scheduled',
    });

    await contest.save();

    console.log(`🏆 Contest created: ${title} (${contest.code})`);

    res.status(201).json({
      message: 'Contest created successfully',
      contest: {
        id: contest._id,
        title: contest.title,
        code: contest.code,
        startTime: contest.startTime,
        endTime: contest.endTime,
        duration: contest.duration,
        problemCount: contest.problems.length,
        status: contest.status,
      },
    });
  } catch (err) {
    console.error('❌ Create contest error:', err);
    res.status(500).json({ error: 'Failed to create contest' });
  }
};

// Points assignment based on difficulty
const getPointsForProblem = (problem, index) => {
  if (!problem) return 100;
  const difficultyPoints = { easy: 100, medium: 200, hard: 300 };
  return difficultyPoints[problem.difficulty] || 100;
};

// ─────────────────────────────────────────────
//  GET /api/contests — List contests
// ─────────────────────────────────────────────
export const listContests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const isAdmin = req.user?.role === 'admin';

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    } else if (!status) {
      // Default: show upcoming and active
      filter.status = { $in: ['scheduled', 'active'] };
    }
    // status === 'all' → no filter (show everything)

    const contests = await Contest.find(filter)
      .populate('problems.problem', 'title difficulty')
      .populate('createdBy', 'name picture')
      .sort({ startTime: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Contest.countDocuments(filter);

    const userId = req.user?._id?.toString();

    // Add participant count without sending full participant list
    // Hide problem details for non-admin users on contests that haven't started
    const contestsWithCounts = contests.map((c) => {
      const isCreator = c.createdBy?._id?.toString() === userId;
      const canSeeProblemDetails = isAdmin || isCreator || c.status === 'active' || c.status === 'ended';

      return {
        ...c,
        participantCount: c.participants?.length || 0,
        participants: undefined, // Don't send full list
        // Mask problem details for scheduled/draft contests (non-admins)
        problems: canSeeProblemDetails
          ? c.problems
          : c.problems.map((cp, idx) => ({
            ...cp,
            problem: { _id: cp.problem?._id, difficulty: cp.problem?.difficulty, title: `Problem ${String.fromCharCode(65 + idx)}` },
          })),
      };
    });

    res.json({
      contests: contestsWithCounts,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('❌ List contests error:', err);
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
};

// ─────────────────────────────────────────────
//  GET /api/contests/:id — Get contest details
// ─────────────────────────────────────────────
export const getContest = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    const contest = await Contest.findById(req.params.id)
      .populate('problems.problem', 'title description difficulty testCases timeLimit memoryLimit')
      .populate('createdBy', 'name picture')
      .lean();

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    const isRegistered = contest.participants?.some(
      (p) => p.user.toString() === userId
    );
    const isCreator = contest.createdBy._id.toString() === userId;

    // Can the user see full problem details?
    // YES if: admin, creator, or contest is active/ended
    // NO if: contest is scheduled/draft and user is a regular participant
    const canSeeProblemDetails = isAdmin || isCreator || contest.status === 'active' || contest.status === 'ended';

    if (canSeeProblemDetails) {
      // Filter out hidden test cases for participants
      if (contest.problems) {
        contest.problems = contest.problems.map((cp) => {
          if (cp.problem?.testCases) {
            cp.problem.testCases = cp.problem.testCases.filter((tc) => !tc.isHidden);
          }
          return cp;
        });
      }
    } else {
      // Contest hasn't started — mask problem details for regular users
      contest.problems = (contest.problems || []).map((cp, idx) => ({
        ...cp,
        problem: {
          _id: cp.problem?._id,
          difficulty: cp.problem?.difficulty,
          title: `Problem ${String.fromCharCode(65 + idx)}`,
          // No description, no testCases
        },
      }));
    }

    // Get participant's problem status if registered
    let myStatus = null;
    if (isRegistered) {
      const participant = contest.participants.find(
        (p) => p.user.toString() === userId
      );
      myStatus = participant?.problemStatus || [];
    }

    res.json({
      contest: {
        ...contest,
        participantCount: contest.participants?.length || 0,
        participants: undefined, // Don't expose full list
        isRegistered,
        isCreator,
        myStatus,
      },
    });
  } catch (err) {
    console.error('❌ Get contest error:', err);
    res.status(500).json({ error: 'Failed to fetch contest' });
  }
};

// ─────────────────────────────────────────────
//  POST /api/contests/:id/register — Register for contest
// ─────────────────────────────────────────────
export const registerForContest = async (req, res) => {
  try {
    const userId = req.user._id;

    // Reject Admins from registering
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot register as participants' });
    }

    // Atomic registration using $push with conditions to prevent race conditions
    // This handles:
    // - Contest existence check
    // - Status check (not ended/cancelled)
    // - Duplicate registration check
    // - Max participant check
    // All in a single atomic operation

    // First fetch contest to get problems list (needed for problemStatus)
    const contest = await Contest.findById(req.params.id);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    if (contest.status === 'ended' || contest.status === 'cancelled') {
      return res.status(400).json({ error: 'Contest has ended or been cancelled' });
    }

    // Build problem status entries
    const problemStatus = contest.problems.map((cp) => ({
      problem: cp.problem,
      solved: false,
      solveTime: null,
      attempts: 0,
      penaltyTime: 0,
    }));

    // Atomic push — only succeeds if user not already in participants
    // and participant count < maxParticipants
    const result = await Contest.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $nin: ['ended', 'cancelled'] },
        'participants.user': { $ne: userId },                      // Not already registered
        [`participants.${contest.maxParticipants - 1}`]: { $exists: false }, // Not full
      },
      {
        $push: {
          participants: {
            user: userId,
            joinedAt: new Date(),
            problemStatus,
            totalSolved: 0,
            totalPenalty: 0,
            totalPoints: 0,
          },
        },
      },
      { new: true }
    );

    if (!result) {
      // Figure out why it failed
      if (contest.isUserRegistered(userId)) {
        return res.status(400).json({ error: 'Already registered for this contest' });
      }
      if (contest.participants.length >= contest.maxParticipants) {
        return res.status(400).json({ error: 'Contest is full' });
      }
      return res.status(400).json({ error: 'Registration failed. Please try again.' });
    }

    // Notify via socket
    try {
      const io = getIO();
      io.to(`contest-${result._id}`).emit('contest-participant-joined', {
        contestId: result._id,
        participantCount: result.participants.length,
      });
    } catch (e) { /* socket not ready yet */ }

    console.log(`📝 User ${req.user.name} registered for contest ${result.title}`);

    res.json({
      message: 'Successfully registered for contest',
      participantCount: result.participants.length,
    });
  } catch (err) {
    console.error('❌ Register contest error:', err);
    res.status(500).json({ error: 'Failed to register for contest' });
  }
};

// ─────────────────────────────────────────────
//  DELETE /api/contests/:id/register — Unregister from contest
// ─────────────────────────────────────────────
export const unregisterFromContest = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    if (contest.status === 'active') {
      return res.status(400).json({ error: 'Cannot unregister from an active contest' });
    }

    const userId = req.user._id.toString();
    const idx = contest.participants.findIndex(
      (p) => p.user.toString() === userId
    );

    if (idx === -1) {
      return res.status(400).json({ error: 'Not registered for this contest' });
    }

    contest.participants.splice(idx, 1);
    await contest.save();

    res.json({
      message: 'Successfully unregistered from contest',
      participantCount: contest.participants.length,
    });
  } catch (err) {
    console.error('❌ Unregister error:', err);
    res.status(500).json({ error: 'Failed to unregister from contest' });
  }
};

// ─────────────────────────────────────────────
//  POST /api/contests/:id/submit — Submit code
// ─────────────────────────────────────────────
export const submitContestCode = async (req, res) => {
  try {
    const { problemId, code, language, isSubmit } = req.body;
    const contestId = req.params.id;
    const userId = req.user._id;

    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot submit code to contests' });
    }

    // Validate input
    if (!problemId || !code || !language) {
      return res.status(400).json({
        error: 'Missing required fields: problemId, code, language',
      });
    }

    // Validate code size (prevent abuse)
    if (typeof code !== 'string' || code.length > MAX_CODE_SIZE) {
      return res.status(400).json({
        error: `Code too large. Maximum ${MAX_CODE_SIZE / 1024} KB allowed.`,
      });
    }

    // Get contest
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Check contest is active
    if (contest.status !== 'active') {
      return res.status(400).json({ error: 'Contest is not active' });
    }

    // Check time
    const now = new Date();
    if (now < contest.startTime || now > contest.endTime) {
      return res.status(400).json({ error: 'Contest is not within submission window' });
    }

    // Check user is registered
    if (!contest.isUserRegistered(userId)) {
      return res.status(403).json({ error: 'Not registered for this contest' });
    }

    // Check problem exists in contest
    const contestProblem = contest.problems.find(
      (p) => p.problem.toString() === problemId
    );
    if (!contestProblem) {
      return res.status(400).json({ error: 'Problem not in this contest' });
    }

    // Check if already solved
    const participant = contest.getParticipant(userId);
    const pStatus = participant?.problemStatus?.find(
      (ps) => ps.problem.toString() === problemId
    );
    if (pStatus?.solved) {
      return res.status(400).json({ error: 'Problem already solved' });
    }

    // Calculate contest time (seconds since start)
    const contestTime = Math.floor((now - contest.startTime) / 1000);

    // Create submission record (ONLY IF it's a real submit)
    let submission = null;
    if (isSubmit) {
      submission = new ContestSubmission({
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
    }

    // Add to processing queue
    const job = await addSubmission({
      submissionId: submission ? submission._id.toString() : 'temp_run',
      contestId,
      userId: userId.toString(),
      problemId,
      sourceCode: code,
      languageId: language,
      contestTime,
      isSubmit,
    });

    console.log(`📩 Contest submission queued: ${submission ? submission._id : 'run'} (job: ${job.id})`);

    res.status(202).json({
      message: 'Submission queued for judging',
      submissionId: submission ? submission._id : null,
      status: 'queued',
      queuePosition: await getQueuePosition(),
    });
  } catch (err) {
    console.error('❌ Contest submit error:', err);
    res.status(500).json({ error: 'Failed to submit code' });
  }
};

const getQueuePosition = async () => {
  const stats = await getQueueStats();
  return stats ? stats.waiting : 0;
};

// ─────────────────────────────────────────────
//  GET /api/contests/:id/leaderboard — Real-time leaderboard
// ─────────────────────────────────────────────
export const getContestLeaderboard = async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 1000;
    const contestId = req.params.id;
    const offset = (parseInt(page) - 1) * limit;

    const contest = await Contest.findById(contestId).lean();
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Get from Redis (real-time)
    const entries = await getLeaderboard(
      contestId, contest.scoringType, offset, parseInt(limit)
    );

    // Enrich with user info
    if (entries.length > 0) {
      const userIds = entries.map((e) => e.userId);
      const users = await User.find(
        { _id: { $in: userIds } },
        'name picture rating'
      ).lean();

      const userMap = {};
      users.forEach((u) => { userMap[u._id.toString()] = u; });

      entries.forEach((entry) => {
        const user = userMap[entry.userId];
        if (user) {
          entry.name = user.name;
          entry.picture = user.picture;
          entry.rating = user.rating;
        }
      });
    }

    // Get current user's rank
    let myRank = null;
    if (req.user) {
      myRank = await getUserRank(contestId, req.user._id.toString());
    }

    const totalParticipants = await getLeaderboardSize(contestId);

    res.json({
      leaderboard: entries,
      myRank,
      totalParticipants,
      page: parseInt(page),
      totalPages: Math.ceil(totalParticipants / parseInt(limit)),
      scoringType: contest.scoringType,
    });
  } catch (err) {
    console.error('❌ Leaderboard error:', err);

    // Fallback: get from MongoDB
    try {
      const contest = await Contest.findById(req.params.id)
        .populate('participants.user', 'name picture rating')
        .lean();

      if (!contest) {
        return res.status(404).json({ error: 'Contest not found' });
      }

      // Sort participants by solved (desc), then penalty (asc)
      const sorted = (contest.participants || []).sort((a, b) => {
        if (b.totalSolved !== a.totalSolved) return b.totalSolved - a.totalSolved;
        return a.totalPenalty - b.totalPenalty;
      });

      const leaderboard = sorted.map((p, idx) => ({
        rank: idx + 1,
        userId: p.user._id,
        name: p.user.name,
        picture: p.user.picture,
        rating: p.user.rating,
        solved: p.totalSolved,
        penalty: p.totalPenalty,
        points: p.totalPoints,
      }));

      res.json({
        leaderboard,
        totalParticipants: leaderboard.length,
        scoringType: contest.scoringType,
        source: 'mongodb-fallback',
      });
    } catch (fallbackErr) {
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  }
};

// ─────────────────────────────────────────────
//  GET /api/contests/:id/submissions — User's submissions
// ─────────────────────────────────────────────
export const getMySubmissions = async (req, res) => {
  try {
    const contestId = req.params.id;
    const userId = req.user._id;
    const { problemId } = req.query;

    const filter = { contest: contestId, user: userId };
    if (problemId) filter.problem = problemId;

    const submissions = await ContestSubmission.find(filter)
      .populate('problem', 'title')
      .sort({ submittedAt: -1 })
      .limit(50)
      .lean();

    res.json({ submissions });
  } catch (err) {
    console.error('❌ Get submissions error:', err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
};

// ─────────────────────────────────────────────
//  POST /api/contests/:id/start — Start contest (admin)
// ─────────────────────────────────────────────
export const startContest = async (req, res) => {
  try {
    console.log(`🟢 startContest called by user ${req.user.name} (role: ${req.user.role}) for contest ${req.params.id}`);
    const contest = await Contest.findById(req.params.id);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Only creator can start
    if (contest.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the contest creator can start it' });
    }

    if (contest.status !== 'scheduled') {
      return res.status(400).json({ error: `Contest cannot be started (status: ${contest.status})` });
    }

    // Start the contest — use atomic update to prevent race conditions
    const now = new Date();
    const endTime = new Date(now.getTime() + contest.duration * 60 * 1000);

    const updated = await Contest.findOneAndUpdate(
      { _id: contest._id, status: 'scheduled' },
      { $set: { status: 'active', startTime: now, endTime } },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ error: 'Contest already started or ended' });
    }

    // Initialize Redis leaderboard with all participants
    const participantIds = updated.participants.map((p) => p.user.toString());
    await initLeaderboard(updated._id.toString(), participantIds);

    // Notify all participants via socket
    try {
      const io = getIO();
      io.to(`contest-${updated._id}`).emit('contest-started', {
        contestId: updated._id,
        startTime: updated.startTime,
        endTime: updated.endTime,
        duration: updated.duration,
      });
    } catch (e) { /* socket not initialized */ }

    console.log(`🏆 Contest started: ${updated.title} (${participantIds.length} participants)`);

    // Auto-end is handled by the contest scheduler (polls every 15s)
    // No volatile setTimeout needed

    res.json({
      message: 'Contest started',
      startTime: updated.startTime,
      endTime: updated.endTime,
    });
  } catch (err) {
    console.error('❌ Start contest error:', err);
    res.status(500).json({ error: 'Failed to start contest' });
  }
};

// ─────────────────────────────────────────────
//  POST /api/contests/:id/end — End contest (admin/auto)
// ─────────────────────────────────────────────
export const endContest = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    if (contest.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the contest creator can end it' });
    }

    await finalizeContest(contest);

    res.json({ message: 'Contest ended', results: contest.participants.length });
  } catch (err) {
    console.error('❌ End contest error:', err);
    res.status(500).json({ error: 'Failed to end contest' });
  }
};

// finalizeContest + updateContestRatings are now in contest-scheduler.service.js

// ─────────────────────────────────────────────
//  GET /api/contests/:id/standings — Final standings
// ─────────────────────────────────────────────
export const getContestStandings = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id)
      .populate('participants.user', 'name picture rating')
      .populate('problems.problem', 'title difficulty')
      .lean();

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Sort by rank
    const standings = (contest.participants || [])
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))
      .map((p) => ({
        rank: p.rank,
        user: p.user,
        totalSolved: p.totalSolved,
        totalPenalty: p.totalPenalty,
        totalPoints: p.totalPoints,
        problemStatus: p.problemStatus,
      }));

    res.json({
      standings,
      problems: contest.problems,
      scoringType: contest.scoringType,
      totalParticipants: standings.length,
    });
  } catch (err) {
    console.error('❌ Standings error:', err);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
};

// ─────────────────────────────────────────────
//  GET /api/contests/queue-stats — Queue monitoring
// ─────────────────────────────────────────────
export const getContestQueueStats = async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json({ stats: stats || { waiting: 0, active: 0, completed: 0, failed: 0 } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch queue stats' });
  }
};

// ─────────────────────────────────────────────
//  POST /api/contests/join — Join by contest code
// ─────────────────────────────────────────────
export const joinByCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Contest code is required' });
    }

    const contest = await Contest.findOne({ code: code.toUpperCase() });
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found with this code' });
    }

    // Reuse register logic
    req.params.id = contest._id;
    return registerForContest(req, res);
  } catch (err) {
    console.error('❌ Join by code error:', err);
    res.status(500).json({ error: 'Failed to join contest' });
  }
};
