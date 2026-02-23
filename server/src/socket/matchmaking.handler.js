import { addToQueue, removeFromQueue, tryMatchPlayers, isInQueue } from './queue.js';
import { createMatch, connectPlayer, startTimer } from './matchState.js';
import { Match } from '../models/Match.model.js';
import { Problem } from '../models/Problem.model.js';
import { getIO } from './index.js';

/**
 * Handle player joining matchmaking queue
 */
export const handleJoinQueue = (io, socket) => {
  socket.on('join-queue', async (data) => {
    try {
      const userId = socket.user._id.toString();
      const totalRounds = Math.min(5, Math.max(1, data?.totalRounds || 1));

      if (isInQueue(userId)) {
        return socket.emit('error', { message: 'Already in queue' });
      }

      const position = addToQueue(
        userId,
        socket.id,
        socket.user.rating,
        socket.user.name,
        socket.user.picture,
        totalRounds,
      );

      console.log('👤 Player info:', {
        userId,
        name: socket.user.name,
        rating: socket.user.rating,
        totalRounds,
      });

      socket.emit('queue-joined', {
        message: 'Joined matchmaking queue',
        position,
        totalRounds,
      });

      console.log(`🎮 ${socket.user.name} joined queue (Best of ${totalRounds}) at position ${position}`);

      // Try to match players with same round preference
      const match = tryMatchPlayers();

      if (match) {
        await createMatchAndNotify(io, match.player1, match.player2);
      }
    } catch (error) {
      console.error('Error in join-queue:', error);
      socket.emit('error', { message: error.message || 'Failed to join queue' });
    }
  });
};

/**
 * Handle player leaving queue
 */
export const handleLeaveQueue = (io, socket) => {
  socket.on('leave-queue', () => {
    try {
      const userId = socket.user._id.toString();
      const removed = removeFromQueue(userId);

      if (removed) {
        socket.emit('queue-left', { message: 'Left matchmaking queue' });
        console.log(`🚪 ${socket.user.name} left queue`);
      } else {
        socket.emit('error', { message: 'Not in queue' });
      }
    } catch (error) {
      console.error('Error in leave-queue:', error);
      socket.emit('error', { message: 'Failed to leave queue' });
    }
  });
};

/**
 * Create match in database and notify players.
 * Picks N distinct random problems based on totalRounds.
 */
const createMatchAndNotify = async (io, player1, player2, options = {}) => {
  try {
    const totalRounds = player1.totalRounds || 1;
    const isPrivate = options.isPrivate || false;

    // Select N distinct random problems
    const problems = await Problem.aggregate([
      { $sample: { size: totalRounds } },
    ]);

    if (problems.length < totalRounds) {
      // Fallback: if not enough problems, use what we have
      const allProblems = await Problem.find();
      if (allProblems.length === 0) {
        throw new Error('No problems available. Please run seed script.');
      }
      // Fill with random picks (may repeat if DB has fewer problems than rounds)
      while (problems.length < totalRounds) {
        const pick = allProblems[Math.floor(Math.random() * allProblems.length)];
        problems.push(pick);
      }
    }

    const problemIds = problems.map((p) => p._id);
    const roomId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build per-player round results skeleton
    const emptyRoundResults = problemIds.map((pid) => ({
      problem: pid,
      solved: false,
      solveTime: null,
      wrongSubmissions: 0,
    }));

    // Create match in database
    const matchDoc = await Match.create({
      roomId,
      problem: problemIds[0],          // Legacy compat: first problem
      problems: problemIds,
      totalRounds,
      currentRound: 0,
      isPrivate,
      players: [
        {
          user: player1.userId,
          socketId: player1.socketId,
          wrongSubmissions: 0,
          solvedCount: 0,
          roundResults: emptyRoundResults,
        },
        {
          user: player2.userId,
          socketId: player2.socketId,
          wrongSubmissions: 0,
          solvedCount: 0,
          roundResults: emptyRoundResults,
        },
      ],
      status: 'waiting',
      startedAt: new Date(),
    });

    // Create match in in-memory state
    createMatch(roomId, player1.userId, player2.userId, problemIds.map(String), totalRounds);

    console.log(`🎮 Match created: ${roomId} (Best of ${totalRounds})`);
    console.log(`   Problems: ${problems.map((p) => p.title).join(', ')}`);
    console.log(`   Players: ${player1.userId} vs ${player2.userId}`);

    // Build problems payload — send all but Arena reveals one at a time
    const allProblemsPayload = problems.map((p) => ({
      id: p._id,
      title: p.title,
      description: p.description,
      difficulty: p.difficulty,
      testCases: (p.testCases || []).filter((tc) => !tc.isHidden),
    }));

    // Notify player 1
    io.to(player1.socketId).emit('match-found', {
      roomId,
      createdAt: Date.now(),
      totalRounds,
      currentRound: 0,
      // Current round's problem
      problem: allProblemsPayload[0],
      // All problems (for round navigation)
      problems: allProblemsPayload,
      opponent: {
        name: player2.name,
        picture: player2.picture,
      },
    });

    // Notify player 2
    io.to(player2.socketId).emit('match-found', {
      roomId,
      createdAt: Date.now(),
      totalRounds,
      currentRound: 0,
      problem: allProblemsPayload[0],
      problems: allProblemsPayload,
      opponent: {
        name: player1.name,
        picture: player1.picture,
      },
    });
  } catch (error) {
    console.error('❌ Error creating match:', error);
    io.to(player1.socketId).emit('error', {
      message: 'Failed to create match. Please try again.',
    });
    io.to(player2.socketId).emit('error', {
      message: 'Failed to create match. Please try again.',
    });
  }
};

/**
 * Handle disconnect while in queue
 */
export const handleQueueDisconnect = (socket) => {
  const userId = socket.user._id.toString();

  if (isInQueue(userId)) {
    removeFromQueue(userId);
    console.log(`🔌 ${socket.user.name} disconnected from queue`);
  }

  // Clean up any private room hosted by this socket
  for (const [code, room] of privateRooms.entries()) {
    if (room.host.userId === userId) {
      privateRooms.delete(code);
      console.log(`🗑️  Private room ${code} deleted (host disconnected)`);
    }
  }
};

// ─────────────────────────────────────────────────────────────
//  Private Room  (in-memory, keyed by 6-char code)
// ─────────────────────────────────────────────────────────────
const privateRooms = new Map(); // code -> { host, totalRounds, createdAt }

const generateCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

/**
 * Create a private room and wait for a friend to join
 */
export const handlePrivateRoom = (io, socket) => {
  // ── Create ──────────────────────────────────────────────────
  socket.on('create-private-room', (data) => {
    try {
      const userId = socket.user._id.toString();
      const totalRounds = Math.min(7, Math.max(1, data?.totalRounds || 3));

      // Remove any stale room this user already owns
      for (const [c, r] of privateRooms.entries()) {
        if (r.host.userId === userId) privateRooms.delete(c);
      }

      let code;
      do { code = generateCode(); } while (privateRooms.has(code));

      privateRooms.set(code, {
        host: {
          userId,
          socketId: socket.id,
          name: socket.user.name,
          picture: socket.user.picture,
          rating: socket.user.rating || 1200,
          totalRounds,
        },
        totalRounds,
        createdAt: Date.now(),
      });

      // Auto-expire after 10 minutes
      setTimeout(() => {
        if (privateRooms.has(code)) {
          privateRooms.delete(code);
          io.to(socket.id).emit('private-room-expired', { code });
          console.log(`⏰ Private room ${code} expired`);
        }
      }, 10 * 60 * 1000);

      socket.emit('private-room-created', { code, totalRounds });
      console.log(`🔒 Private room ${code} created by ${socket.user.name} (Bo${totalRounds})`);
    } catch (err) {
      console.error('Error in create-private-room:', err);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // ── Cancel (host cancels before anyone joins) ────────────────
  socket.on('cancel-private-room', (data) => {
    const { code } = data || {};
    if (!code) return;
    const room = privateRooms.get(code);
    if (room && room.host.userId === socket.user._id.toString()) {
      privateRooms.delete(code);
      socket.emit('private-room-cancelled', { code });
      console.log(`❌ Private room ${code} cancelled by host`);
    }
  });

  // ── Join ─────────────────────────────────────────────────────
  socket.on('join-private-room', async (data) => {
    try {
      const { code } = data || {};
      if (!code) return socket.emit('error', { message: 'Room code required' });

      const room = privateRooms.get(code.toUpperCase().trim());
      if (!room) {
        return socket.emit('error', { message: 'Room not found. Check the code and try again.' });
      }

      const joinerId = socket.user._id.toString();
      if (room.host.userId === joinerId) {
        return socket.emit('error', { message: "You can't join your own room." });
      }

      // Consume the room
      privateRooms.delete(code.toUpperCase().trim());

      const joiner = {
        userId: joinerId,
        socketId: socket.id,
        name: socket.user.name,
        picture: socket.user.picture,
        rating: socket.user.rating || 1200,
        totalRounds: room.totalRounds,
      };

      await createMatchAndNotify(io, room.host, joiner, { isPrivate: true });
      console.log(`🎮 Private match started: ${room.host.name} vs ${socket.user.name}`);
    } catch (err) {
      console.error('Error in join-private-room:', err);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });
};