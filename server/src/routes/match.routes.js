import express from 'express';
import { Match } from '../models/Match.model.js';
import { User } from '../models/User.model.js';
import { Submission } from '../models/Submission.model.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/matches/history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const matches = await Match.find({
      'players.user': req.user._id,
      status: { $in: ['completed', 'abandoned'] }
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('problem', 'title difficulty')
      .populate('problems', 'title difficulty')
      .populate('winner', 'name picture')
      .populate('players.user', 'name picture')
      .populate('players.roundResults.problem', 'title difficulty')
      .lean();

    // Normalize: ensure every match has `problems` array for frontend
    const normalized = matches.map((m) => {
      if (!m.problems || m.problems.length === 0) {
        // Legacy single-problem match
        m.problems = m.problem ? [m.problem] : [];
        m.totalRounds = 1;
        m.currentRound = 0;
      }
      return m;
    });

    res.json({ success: true, matches: normalized });
  } catch (error) {
    console.error('Match history error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/matches/recent — last 5 matches for dashboard
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const matches = await Match.find({
      'players.user': req.user._id,
      status: { $in: ['completed', 'abandoned'] },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('problem', 'title difficulty')
      .populate('problems', 'title difficulty')
      .populate('winner', 'name picture')
      .populate('players.user', 'name picture')
      .lean();

    const recentActivity = matches.map((match) => {
      const isWin = match.winner?._id?.toString() === userId;
      const opponent = match.players?.find(
        (p) => p.user?._id?.toString() !== userId
      );

      const me = match.players?.find(
        (p) => p.user?._id?.toString() === userId
      );

      return {
        id: match._id,
        type: isWin ? 'victory' : 'defeat',
        opponent: opponent?.user?.name || 'Unknown',
        problem: match.problem?.title || match.problems?.[0]?.title || 'Unknown',
        difficulty: match.problem?.difficulty || match.problems?.[0]?.difficulty || 'medium',
        duration: match.duration || 0,
        createdAt: match.createdAt,
        ratingChange: isWin ? '+25' : '-15',
        totalRounds: match.totalRounds || 1,
        myScore: me?.solvedCount || (isWin ? 1 : 0),
        opponentScore: opponent?.solvedCount || (isWin ? 0 : 1),
      };
    });

    res.json({ success: true, activity: recentActivity });
  } catch (error) {
    console.error('Recent matches error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/matches/:id/details — Full match details + user's submissions
router.get('/:id/details', authenticateToken, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('problem', 'title difficulty description')
      .populate('problems', 'title difficulty description')
      .populate('winner', 'name picture')
      .populate('players.user', 'name picture')
      .populate('players.roundResults.problem', 'title difficulty')
      .lean();

    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

    const isPlayer = match.players.some(
      (p) => p.user?._id?.toString() === req.user._id.toString()
    );
    if (!isPlayer) return res.status(403).json({ success: false, message: 'Access denied' });

    // Normalise problems array (same as history route)
    if (!match.problems || match.problems.length === 0) {
      match.problems = match.problem ? [match.problem] : [];
      match.totalRounds = 1;
    }

    // Get this user's submissions for the match, newest last
    const submissions = await Submission.find({
      match: match._id,
      user: req.user._id,
    })
      .populate('problem', 'title difficulty')
      .sort({ submittedAt: 1 })
      .lean();

    res.json({ success: true, match, submissions });
  } catch (error) {
    console.error('Match details error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/matches/complete — Handle match completion
router.post('/complete', authenticateToken, async (req, res) => {
  try {
    const { matchId, winnerId, loserId } = req.body;

    if (!matchId || !winnerId || !loserId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Update winner stats
    await User.findByIdAndUpdate(winnerId, {
      $inc: { matchesPlayed: 1, matchesWon: 1, rating: 25 },
    });

    // Update loser stats
    const loser = await User.findById(loserId);
    const newRating = Math.max(0, (loser.rating || 1200) - 15);

    await User.findByIdAndUpdate(loserId, {
      $inc: { matchesPlayed: 1 },
      $set: { rating: newRating },
    });

    // Update match status
    await Match.findByIdAndUpdate(matchId, {
      status: 'completed',
      winner: winnerId,
      completedAt: new Date(),
    });

    res.json({ success: true, message: 'Match completed' });
  } catch (error) {
    console.error('Match complete error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;