import express from 'express';
import { User } from '../models/User.model.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { onlineUsers, getIO } from '../socket/index.js';

const router = express.Router();

/**
 * GET /api/users/stats
 * Get authenticated user's detailed stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const losses = (user.matchesPlayed || 0) - (user.matchesWon || 0);
    const winRate = user.matchesPlayed
      ? ((user.matchesWon / user.matchesPlayed) * 100).toFixed(1)
      : '0.0';

    res.json({
      success: true,
      stats: {
        name: user.name,
        picture: user.picture,
        rating: user.rating || 1200,
        matchesPlayed: user.matchesPlayed || 0,
        matchesWon: user.matchesWon || 0,
        losses,
        winRate: parseFloat(winRate),
      },
    });
  } catch (error) {
    console.error('❌ User stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/users/leaderboard
 * Get all players sorted by rating (public)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const topPlayers = await User.find({ role: { $ne: 'admin' } })
      .sort({ rating: -1 })
      .limit(100)
      .select('name picture rating matchesPlayed matchesWon email _id')
      .lean();

    const formattedPlayers = topPlayers.map((player) => ({
      _id: player._id,
      name: player.name,
      email: player.email,
      picture: player.picture,
      rating: player.rating || 1200,
      matchesPlayed: player.matchesPlayed || 0,
      wins: player.matchesWon || 0,
      totalMatches: player.matchesPlayed || 0,
    }));

    res.json(formattedPlayers);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Friends API ──────────────────────────────────────────────────────────────

/** GET /api/users/search?q= — search users to add as friends */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, users: [] });

    const me = await User.findById(req.user._id).select('friends friendRequests').lean();
    const friendIds = (me.friends || []).map((id) => id.toString());
    const pendingFromMeIds = new Set(); // IDs I have already sent a request to
    const pendingToMeIds = new Set(); // IDs who sent me a request

    (me.friendRequests || []).forEach((r) => pendingToMeIds.add(r.from.toString()));

    // Check which users already have a request from me
    const usersWithMyRequest = await User.find({
      'friendRequests.from': req.user._id,
    }).select('_id').lean();
    usersWithMyRequest.forEach((u) => pendingFromMeIds.add(u._id.toString()));

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    })
      .limit(15)
      .select('name picture email rating matchesPlayed matchesWon')
      .lean();

    const result = users.map((u) => {
      const uid = u._id.toString();
      let relation = 'none';
      if (friendIds.includes(uid)) relation = 'friends';
      else if (pendingFromMeIds.has(uid)) relation = 'requested';
      else if (pendingToMeIds.has(uid)) relation = 'incoming';
      return { ...u, relation };
    });

    res.json({ success: true, users: result });
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** GET /api/users/friends — list my friends with online status */
router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.user._id)
      .populate('friends', 'name picture rating matchesPlayed matchesWon')
      .lean();

    const friends = (me.friends || []).map((f) => ({
      ...f,
      isOnline: onlineUsers.has(f._id.toString()),
    }));

    // Sort: online first
    friends.sort((a, b) => b.isOnline - a.isOnline);

    res.json({ success: true, friends });
  } catch (err) {
    console.error('Friends list error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** GET /api/users/friends/requests — incoming pending friend requests */
router.get('/friends/requests', authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.user._id)
      .populate('friendRequests.from', 'name picture rating')
      .lean();

    res.json({ success: true, requests: me.friendRequests || [] });
  } catch (err) {
    console.error('Friend requests error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** POST /api/users/friends/request/:targetId — send friend request */
router.post('/friends/request/:targetId', authenticateToken, async (req, res) => {
  try {
    const { targetId } = req.params;
    const myId = req.user._id.toString();

    if (targetId === myId) return res.status(400).json({ success: false, message: 'Cannot add yourself' });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    // Already friends?
    const me = await User.findById(myId).select('friends').lean();
    if ((me.friends || []).some((id) => id.toString() === targetId))
      return res.status(400).json({ success: false, message: 'Already friends' });

    // Already sent?
    const alreadySent = target.friendRequests?.some((r) => r.from.toString() === myId);
    if (alreadySent) return res.status(400).json({ success: false, message: 'Request already sent' });

    // Incoming request from them? Auto-accept
    const myDoc = await User.findById(myId);
    const incoming = myDoc.friendRequests?.find((r) => r.from.toString() === targetId);
    if (incoming) {
      // Auto-accept both ways
      await User.findByIdAndUpdate(myId, {
        $pull: { friendRequests: { from: targetId } },
        $addToSet: { friends: targetId },
      });
      await User.findByIdAndUpdate(targetId, {
        $addToSet: { friends: myId },
      });
      // Notify target that their request was accepted
      try {
        getIO().to(targetId).emit('friend-request-accepted', {
          byId: myId,
          byName: req.user.name,
          byPicture: req.user.picture || null,
        });
      } catch (_) { }
      return res.json({ success: true, message: 'Auto-accepted! You are now friends.' });
    }

    await User.findByIdAndUpdate(targetId, {
      $push: { friendRequests: { from: myId } },
    });

    // Notify target in real-time if they are online
    try {
      console.log(`📡 Emitting friend-request-received to room: ${targetId}`);
      getIO().to(targetId).emit('friend-request-received', {
        fromId: myId,
        fromName: req.user.name,
        fromPicture: req.user.picture || null,
      });
    } catch (_) { }

    res.json({ success: true, message: 'Friend request sent!' });
  } catch (err) {
    console.error('Send friend request error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** POST /api/users/friends/accept/:fromId — accept incoming request */
router.post('/friends/accept/:fromId', authenticateToken, async (req, res) => {
  try {
    const { fromId } = req.params;
    const myId = req.user._id.toString();

    await User.findByIdAndUpdate(myId, {
      $pull: { friendRequests: { from: fromId } },
      $addToSet: { friends: fromId },
    });
    await User.findByIdAndUpdate(fromId, {
      $addToSet: { friends: myId },
    });

    // Notify the original sender that their request was accepted
    try {
      getIO().to(fromId).emit('friend-request-accepted', {
        byId: myId,
        byName: req.user.name,
        byPicture: req.user.picture || null,
      });
    } catch (_) { }

    res.json({ success: true, message: 'Friend request accepted!' });
  } catch (err) {
    console.error('Accept friend request error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** POST /api/users/friends/decline/:fromId — decline incoming request */
router.post('/friends/decline/:fromId', authenticateToken, async (req, res) => {
  try {
    const { fromId } = req.params;
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { friendRequests: { from: fromId } },
    });
    res.json({ success: true, message: 'Request declined.' });
  } catch (err) {
    console.error('Decline friend request error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** DELETE /api/users/friends/:friendId — remove a friend */
router.delete('/friends/:friendId', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.params;
    const myId = req.user._id.toString();

    await User.findByIdAndUpdate(myId, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: myId } });

    res.json({ success: true, message: 'Friend removed.' });
  } catch (err) {
    console.error('Remove friend error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
