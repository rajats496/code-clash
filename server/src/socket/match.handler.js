import {
  getMatch,
  getMatchByUserId,
  connectPlayer,
  updatePlayerCode,
  startTimer,
  stopTimer,
  deleteMatch,
  advanceRound,
} from './matchState.js';
import { runTestCases } from '../services/contest-execution.service.js';
import { Problem } from '../models/Problem.model.js';
import { Match } from '../models/Match.model.js';
import { Submission } from '../models/Submission.model.js';
import { User } from '../models/User.model.js';
import { consumeToken } from '../services/rate-limit.service.js';
import { getCachedResult, setCachedResult } from '../services/execution-cache.service.js';

/**
 * Update player stats after match ends
 */
const updatePlayerStats = async (winnerId, loserId) => {
  try {
    await User.findByIdAndUpdate(winnerId, {
      $inc: { matchesPlayed: 1, matchesWon: 1, rating: 25 },
    });

    const loser = await User.findById(loserId);
    const newRating = Math.max(0, (loser.rating || 1200) - 15);

    await User.findByIdAndUpdate(loserId, {
      $inc: { matchesPlayed: 1 },
      $set: { rating: newRating },
    });

    console.log('📊 Player stats updated - Winner:', winnerId, 'Loser:', loserId);
  } catch (error) {
    console.error('❌ Error updating player stats:', error);
  }
};

/**
 * Check if a player has won the match (majority of rounds)
 */
const checkMatchWinner = (match) => {
  const majority = Math.ceil(match.totalRounds / 2);
  const playerIds = Object.keys(match.players);

  for (const pid of playerIds) {
    if (match.players[pid].solvedCount >= majority) {
      return pid; // This player wins
    }
  }

  // All rounds played? Determine winner by total solved, then by time
  if (match.currentRound >= match.totalRounds - 1) {
    const [p1Id, p2Id] = playerIds;
    const p1 = match.players[p1Id];
    const p2 = match.players[p2Id];

    // Check if current round is done (both attempted or one solved)
    const currentRoundDone =
      p1.roundResults[match.currentRound].solved ||
      p2.roundResults[match.currentRound].solved ||
      (p1.firstAcceptedAt && p2.firstAcceptedAt);

    if (!currentRoundDone) return null; // Current round still in progress

    if (p1.solvedCount > p2.solvedCount) return p1Id;
    if (p2.solvedCount > p1.solvedCount) return p2Id;

    // Tie in solved count — compare total solve time
    const p1Time = p1.roundResults.reduce((s, r) => s + (r.solveTime || 0), 0);
    const p2Time = p2.roundResults.reduce((s, r) => s + (r.solveTime || 0), 0);

    if (p1Time < p2Time) return p1Id;
    if (p2Time < p1Time) return p2Id;

    // True tie — first player alphabetically (arbitrary)
    return p1Id;
  }

  return null; // Not enough rounds played yet
};

/**
 * Handle player joining a match room
 */
export const handleJoinMatch = (io, socket) => {
  socket.on('join-match', async (data) => {
    try {
      const roomId = data?.roomId != null ? String(data.roomId) : null;
      if (!roomId) {
        return socket.emit('error', { message: 'Room ID required' });
      }
      const userId = socket.user._id.toString();

      const match = getMatch(roomId);

      if (!match) {
        return socket.emit('error', { message: 'Match not found' });
      }

      // Match already ended (e.g. opponent surrendered before this socket joined)
      if (match.status === 'completed' && match.winner) {
        socket.emit('match-end', {
          roomId,
          winner: match.winner,
          reason: 'opponent-left',
          message: 'You win! Opponent left the match.',
        });
        return;
      }

      if (!match.players[userId]) {
        return socket.emit('error', { message: 'You are not in this match' });
      }

      socket.join(roomId);
      console.log(`✅ ${socket.user.name} joined socket room ${roomId}`);

      connectPlayer(roomId, userId, socket.id);

      console.log(`✅ User ${socket.user.name} joined match ${roomId}`);

      // Send current match state including round info
      socket.emit('match-state', {
        roomId: match.roomId,
        problemId: match.problemIds[match.currentRound],
        players: match.players,
        timer: {
          startTime: match.timer.startTime,    // epoch ms for client-side calc
          currentTime: match.timer.currentTime,
          isRunning: match.timer.isRunning,
        },
        status: match.status,
        currentRound: match.currentRound,
        totalRounds: match.totalRounds,
      });

      // Check if both players are connected
      const bothConnected = Object.values(match.players).every(
        (p) => p.connected
      );

      if (bothConnected && match.status === 'waiting') {
        startTimer(roomId, io);

        io.to(roomId).emit('match-start', {
          message: 'Match started! Good luck!',
          startTime: match.timer.startTime,
          currentRound: 0,
          totalRounds: match.totalRounds,
        });

        console.log(`🚀 Match ${roomId} started! (Best of ${match.totalRounds})`);
      }
    } catch (error) {
      console.error('Error in join-match:', error);
      socket.emit('error', { message: 'Failed to join match' });
    }
  });
};

/**
 * Handle code updates (throttled on client)
 */
export const handleCodeUpdate = (io, socket) => {
  socket.on('code-update', async (data) => {
    try {
      const { code, language } = data;
      const userId = socket.user._id.toString();

      const match = getMatchByUserId(userId);

      if (!match) {
        return socket.emit('error', { message: 'You are not in a match' });
      }

      if (match.status !== 'in-progress') {
        return socket.emit('error', { message: 'Match is not in progress' });
      }

      updatePlayerCode(match.roomId, userId, code, language);

      // Notify the opponent that this player is actively typing
      socket.to(match.roomId).emit('opponent-typing', { userId });
    } catch (error) {
      console.error('Error in code-update:', error);
      socket.emit('error', { message: 'Failed to update code' });
    }
  });
};

/**
 * Finalize and end the match
 */
const finalizeMatch = async (io, match, winnerId, socket) => {
  const playerIds = Object.keys(match.players);
  const loserId = playerIds.find((id) => id !== winnerId);

  match.winner = winnerId;
  match.status = 'completed';
  stopTimer(match.roomId);

  // Build score
  const winnerScore = match.players[winnerId].solvedCount;
  const loserScore = match.players[loserId]?.solvedCount || 0;

  // Update database
  const updateData = {
    winner: winnerId,
    status: 'completed',
    completedAt: new Date(),
    currentRound: match.currentRound,
    duration: match.timer.currentTime,
  };

  // Update player round results in DB
  const matchDoc = await Match.findOne({ roomId: match.roomId });
  if (matchDoc) {
    for (let pi = 0; pi < matchDoc.players.length; pi++) {
      const dbPlayer = matchDoc.players[pi];
      const memPlayer = match.players[dbPlayer.user.toString()];
      if (memPlayer) {
        dbPlayer.solvedCount = memPlayer.solvedCount;
        dbPlayer.roundResults = memPlayer.roundResults.map((r, idx) => ({
          problem: match.problemIds[idx],
          solved: r.solved,
          solveTime: r.solveTime,
          wrongSubmissions: r.wrongSubmissions,
        }));
      }
    }
    matchDoc.winner = winnerId;
    matchDoc.status = 'completed';
    matchDoc.completedAt = new Date();
    matchDoc.currentRound = match.currentRound;
    matchDoc.duration = match.timer.currentTime;
    await matchDoc.save();
  }

  await updatePlayerStats(winnerId, loserId);

  io.to(match.roomId).emit('match-end', {
    roomId: match.roomId,
    winner: winnerId,
    winnerName: socket.user.name,
    winnerScore,
    loserScore,
    totalRounds: match.totalRounds,
    reason: 'match-won',
    message: `${socket.user.name} wins the match ${winnerScore}-${loserScore}!`,
  });

  console.log(`🏁 Match ${match.roomId} completed. Winner: ${socket.user.name} (${winnerScore}-${loserScore})`);
  deleteMatch(match.roomId);
};

/**
 * Handle code submission — with multi-round logic
 */
export const handleCodeSubmit = (io, socket) => {
  socket.on('submit-code', async (data) => {
    try {
      const { code, language, isSubmit } = data;
      const userId = socket.user._id.toString();

      console.log(`📤 Submission from ${socket.user.name} (Round ${(getMatchByUserId(userId)?.currentRound || 0) + 1})`);

      const match = getMatchByUserId(userId);
      if (!match) {
        return socket.emit('error', { message: 'You are not in a match' });
      }

      if (match.status !== 'in-progress') {
        return socket.emit('error', { message: 'Match is not in progress' });
      }

      if (!code || code.trim().length === 0) {
        return socket.emit('submission-result', {
          verdict: 'Error',
          message: 'Code cannot be empty',
        });
      }

      if (code.length > 50000) {
        return socket.emit('submission-result', {
          verdict: 'Error',
          message: 'Code too long (max 50KB)',
        });
      }

      // Per-user rate limiting
      const scope = isSubmit ? 'arena:submit' : 'arena:run';
      const rate = await consumeToken({
        scope,
        id: userId,
        maxTokens: isSubmit ? 3 : 10,
        windowSeconds: 60,
      });

      if (!rate.allowed) {
        return socket.emit('submission-result', {
          verdict: 'Rate Limited',
          message: 'Too many submissions. Please wait a moment and try again.',
          isSubmit,
          resetAt: rate.resetAt,
        });
      }

      socket.emit('submission-status', {
        status: 'processing',
        message: 'Running test cases...',
      });

      // Get current round's problem
      const currentProblemId = match.problemIds[match.currentRound];
      const problem = await Problem.findById(currentProblemId);
      if (!problem) {
        return socket.emit('error', { message: 'Problem not found' });
      }

      // If just running, only use visible test cases
      const testCasesToRun = isSubmit ? problem.testCases : problem.testCases.filter(tc => !tc.isHidden);

      console.log(`🧪 Running ${testCasesToRun.length} test cases (Round ${match.currentRound + 1})...`);

      // Cache RUN-only executions when code/problem/language match
      const languageId = language;
      if (!isSubmit) {
        const cached = await getCachedResult({
          problemId: currentProblemId.toString(),
          languageId,
          code,
          visibleOnly: true,
        });
        if (cached) {
          console.log('⚡ Using cached execution result for RUN (arena)');
          socket.emit('submission-result', {
            verdict: cached.verdict,
            message: `${cached.passedTests}/${cached.totalTests} test cases passed`,
            testResults: cached.testResults,
            allPassed: cached.allTestsPassed,
            runtime: cached.runtime || null,
            memory: cached.memory || null,
            compilationError: cached.compilationError || null,
            isSubmit: false,
          });
          return;
        }
      }

      const result = await runTestCases(code, language, testCasesToRun);

      console.log(`✅ Result: ${result.verdict} (${result.passedTests}/${result.totalTests} passed)`);

      // Send result to player first — cache write is best-effort only
      socket.emit('submission-result', {
        verdict: result.verdict,
        message: `${result.passedTests}/${result.totalTests} test cases passed`,
        testResults: result.testResults,
        allPassed: result.allTestsPassed,
        runtime: result.runtime || null,
        memory: result.memory || null,
        compilationError: result.compilationError || null,
        isSubmit: isSubmit,
      });

      // Best-effort cache write; failures must not affect user-visible result
      if (!isSubmit) {
        setCachedResult({
          problemId: currentProblemId.toString(),
          languageId,
          code,
          visibleOnly: true,
          result,
        }).catch((err) => {
          console.error('Failed to write RUN result to cache (arena):', err.message);
        });
      }

      // If it's just a run, skip all scoring and DB saving logic
      if (!isSubmit) return;

      // Save submission to database
      const matchDoc = await Match.findOne({ roomId: match.roomId });
      if (matchDoc) {
        await Submission.create({
          match: matchDoc._id,
          user: userId,
          problem: problem._id,
          code,
          language,
          verdict: result.verdict,
          submittedAt: new Date(),
        });
      }

      // ── ACCEPTED — Round logic ──
      if (result.verdict === 'Accepted') {
        const player = match.players[userId];
        const otherPlayerId = Object.keys(match.players).find((id) => id !== userId);
        const otherPlayer = match.players[otherPlayerId];

        // Check if this player already solved this round
        if (player.roundResults[match.currentRound].solved) {
          console.log(`⚠️ ${socket.user.name} already solved round ${match.currentRound + 1}`);
          return;
        }

        // Calculate solve time for this round
        const roundStartTime = match.roundStartTimes[match.currentRound] || match.timer.startTime;
        const solveTime = Math.floor((Date.now() - roundStartTime) / 1000);

        // Mark this player's round as solved
        player.roundResults[match.currentRound].solved = true;
        player.roundResults[match.currentRound].solveTime = solveTime;
        player.firstAcceptedAt = Date.now();
        player.solvedCount += 1;

        console.log(`🏆 ${socket.user.name} solved round ${match.currentRound + 1} in ${solveTime}s (Total solved: ${player.solvedCount})`);

        // Emit round-won to both players
        io.to(match.roomId).emit('round-won', {
          round: match.currentRound,
          winnerId: userId,
          winnerName: socket.user.name,
          solveTime,
          scores: {
            [userId]: player.solvedCount,
            [otherPlayerId]: otherPlayer.solvedCount,
          },
        });

        // Check if match should end
        const matchWinner = checkMatchWinner(match);

        if (matchWinner) {
          // Find the winner's name
          const winnerSocket = matchWinner === userId ? socket : null;
          if (winnerSocket) {
            await finalizeMatch(io, match, matchWinner, socket);
          } else {
            // Winner is the other player, we need their name
            const winnerUser = await User.findById(matchWinner);
            await finalizeMatch(io, match, matchWinner, {
              user: { name: winnerUser?.name || 'Player' },
            });
          }
        } else if (match.currentRound < match.totalRounds - 1) {
          // Advance to next round after a brief delay
          console.log(`➡️ Advancing to round ${match.currentRound + 2}/${match.totalRounds}`);

          setTimeout(() => {
            const currentMatch = getMatch(match.roomId);
            if (!currentMatch) return;

            advanceRound(match.roomId);

            const nextProblemId = currentMatch.problemIds[currentMatch.currentRound];

            // Fetch next problem details and send to players
            Problem.findById(nextProblemId).then((nextProblem) => {
              if (!nextProblem) return;

              io.to(match.roomId).emit('next-round', {
                currentRound: currentMatch.currentRound,
                totalRounds: currentMatch.totalRounds,
                problem: {
                  id: nextProblem._id,
                  title: nextProblem.title,
                  description: nextProblem.description,
                  difficulty: nextProblem.difficulty,
                  testCases: nextProblem.testCases.filter((tc) => !tc.isHidden),
                },
                scores: Object.fromEntries(
                  Object.entries(currentMatch.players).map(([pid, p]) => [pid, p.solvedCount])
                ),
              });

              console.log(`📋 Round ${currentMatch.currentRound + 1}: ${nextProblem.title}`);
            });
          }, 3000); // 3-second delay between rounds
        }
      } else {
        // Wrong answer — track wrong submissions for current round
        const player = match.players[userId];
        if (player) {
          player.wrongSubmissions += 1;
          player.roundResults[match.currentRound].wrongSubmissions += 1;
        }

        console.log(`❌ ${socket.user.name} - ${result.verdict} (Round ${match.currentRound + 1})`);
      }
    } catch (error) {
      console.error('❌ Error in submit-code:', error);
      socket.emit('error', { message: 'Failed to process submission' });
    }
  });
};

/**
 * Handle player voluntarily leaving match (surrender)
 */
export const handleLeaveMatch = (io, socket) => {
  socket.on('leave-match', async (data) => {
    try {
      const roomId = data?.roomId != null ? String(data.roomId) : null;
      if (!roomId) return;

      const userId = socket.user._id.toString();
      const match = getMatch(roomId);
      if (!match) return;

      const opponentId = Object.keys(match.players).find((id) => id !== userId);

      console.log(`🚪 ${socket.user.name} is leaving match ${roomId}`);

      if (opponentId) {
        stopTimer(roomId);
        match.status = 'completed';
        match.winner = opponentId;

        if (match.players[opponentId]?.connected) {
          await Match.findOneAndUpdate(
            { roomId },
            {
              winner: opponentId,
              status: 'completed',
              completedAt: new Date(),
              duration: match.timer.currentTime,
            }
          );
          await updatePlayerStats(opponentId, userId);
        }

        // Always emit to room so opponent sees surrender (they may be in room but .connected not yet set)
        io.to(roomId).emit('match-end', {
          roomId,
          winner: opponentId,
          reason: 'opponent-left',
          message: 'You win! Opponent left the match.',
        });
        console.log(`🏆 Opponent wins - ${socket.user.name} left the match`);
      }

      // Delay delete so opponent has time to receive match-end
      setTimeout(() => deleteMatch(roomId), 2000);
    } catch (error) {
      console.error('❌ Error in leave-match:', error);
    }
  });
};

/**
 * Handle player disconnect
 */
export const onPlayerDisconnect = (io, socket) => {
  if (!socket?.user?._id) return;

  try {
    const userId = socket.user._id.toString();
    console.log('🔌 onPlayerDisconnect called for:', socket.user.name);
    const match = getMatchByUserId(userId);

    if (!match) {
      console.log('⚠️ No active match for this user');
      return;
    }

    console.log(`🔌 ${socket.user.name} disconnected from match ${match.roomId}`);

    if (match.players[userId]) {
      match.players[userId].connected = false;
    }

    // 3-second buffer before notifying opponent
    setTimeout(() => {
      const currentMatch = getMatch(match.roomId);
      if (!currentMatch) return;

      if (!currentMatch.players[userId]?.connected) {
        io.to(match.roomId).emit('opponent-disconnected', {
          userId,
          message: `${socket.user.name} disconnected`,
        });
      }
    }, 3000);

    // 30-second grace period to reconnect
    setTimeout(async () => {
      const currentMatch = getMatch(match.roomId);
      if (!currentMatch) return;

      if (!currentMatch.players[userId]?.connected) {
        console.log(`⏰ ${socket.user.name} did not reconnect. Forfeiting...`);

        const opponentId = Object.keys(currentMatch.players).find(
          (id) => id !== userId
        );

        if (opponentId && currentMatch.players[opponentId]?.connected) {
          currentMatch.winner = opponentId;
          currentMatch.status = 'completed';
          stopTimer(match.roomId);

          await Match.findOneAndUpdate(
            { roomId: match.roomId },
            {
              winner: opponentId,
              status: 'completed',
              completedAt: new Date(),
              duration: currentMatch.timer.currentTime,
            }
          );

          await updatePlayerStats(opponentId, userId);

          io.to(match.roomId).emit('match-end', {
            roomId: match.roomId,
            winner: opponentId,
            reason: 'opponent-disconnected',
            message: 'You win! Opponent disconnected.',
          });

          deleteMatch(match.roomId);
        } else {
          currentMatch.status = 'abandoned';
          stopTimer(match.roomId);
          deleteMatch(match.roomId);
        }
      }
    }, 30000);
  } catch (error) {
    console.error('❌ Error in onPlayerDisconnect:', error);
  }
};

/**
 * Handle post-match chat messages between players
 */
export const handlePostMatchChat = (io, socket) => {
  // Join a completed match's chat room (validated against DB, not in-memory state)
  socket.on('join-post-match-chat', async (data) => {
    try {
      const { roomId } = data || {};
      if (!roomId) return;
      const userId = socket.user._id.toString();
      const matchDoc = await Match.findOne({
        roomId,
        'players.user': userId,
      }).lean();
      if (!matchDoc) {
        return socket.emit('error', { message: 'Match not found or access denied.' });
      }
      socket.join(roomId);
      // Send persisted chat history to the joining client
      const history = (matchDoc.chatMessages || []).map((m) => ({
        roomId,
        userId: m.userId,
        senderName: m.senderName,
        senderPicture: m.senderPicture,
        message: m.message,
        sentAt: m.sentAt,
      }));
      socket.emit('chat-history', { roomId, messages: history });
      console.log(`💬 ${socket.user.name} joined post-match chat room ${roomId}`);
    } catch (error) {
      console.error('❌ Error in join-post-match-chat:', error);
    }
  });

  socket.on('post-match-chat-message', async (data) => {
    try {
      const { roomId, message } = data || {};
      const trimmed = (message || '').trim();

      if (!roomId || !trimmed) return;

      const userId = socket.user._id.toString();

      const matchDoc = await Match.findOne({
        roomId,
        'players.user': userId,
      }).lean();

      if (!matchDoc) {
        return socket.emit('error', {
          message: 'You cannot chat in this match.',
        });
      }

      // Ensure sender is in the room so they receive the echo
      socket.join(roomId);

      const payload = {
        roomId,
        userId,
        senderName: socket.user.name,
        senderPicture: socket.user.picture,
        message: trimmed,
        sentAt: new Date().toISOString(),
      };

      // Persist to DB
      await Match.updateOne(
        { roomId },
        { $push: { chatMessages: { userId, senderName: socket.user.name, senderPicture: socket.user.picture, message: trimmed, sentAt: payload.sentAt } } }
      );

      io.to(roomId).emit('post-match-chat-message', payload);
    } catch (error) {
      console.error('❌ Error in post-match chat:', error);
      socket.emit('error', { message: 'Failed to send chat message' });
    }
  });
};