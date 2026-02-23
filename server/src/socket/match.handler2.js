import {
  getMatch,
  getMatchByUserId,
  connectPlayer,
  updatePlayerCode,
  startTimer,
  stopTimer,
  deleteMatch,
} from './matchState.js';
import { runTestCases } from '../services/mock-execution.service.js';
import { Problem } from '../models/Problem.model.js';
import { Match } from '../models/Match.model.js';
import { Submission } from '../models/Submission.model.js';
import { User } from '../models/User.model.js';


const updatePlayerStats = async (winnerId, loserId) => {
  try {
    // Update winner
    await User.findByIdAndUpdate(winnerId, {
      $inc: { 
        matchesPlayed: 1, 
        matchesWon: 1,
        rating: 25  // +25 rating for win
      }
    });

    // Update loser
    await User.findByIdAndUpdate(loserId, {
      $inc: { 
        matchesPlayed: 1,
        rating: -15  // -15 rating for loss (minimum 0)
      }
    });

    console.log('📊 Player stats updated');
  } catch (error) {
    console.error('❌ Error updating player stats:', error);
  }
};
/**
 * Handle player joining a match room
 */
export const handleJoinMatch = (io, socket) => {
  socket.on('join-match', async (data) => {
    try {
      const { roomId } = data;
      const userId = socket.user._id.toString();

      // Get match from state
      const match = getMatch(roomId);

      if (!match) {
        return socket.emit('error', { message: 'Match not found' });
      }

      // Verify user belongs to this match
      if (!match.players[userId]) {
        return socket.emit('error', { message: 'You are not in this match' });
      }

      // Join socket room
     socket.join(roomId);
console.log(`✅ ${socket.user.name} joined socket room ${roomId}`);

      // Update player connection
      connectPlayer(roomId, userId, socket.id);

      console.log(`✅ User ${socket.user.name} joined match ${roomId}`);

      // Send current match state to the player
      socket.emit('match-state', {
        roomId: match.roomId,
        problemId: match.problemId,
        players: match.players,
        timer: {
          currentTime: match.timer.currentTime,
          isRunning: match.timer.isRunning,
        },
        status: match.status,
      });

      // Check if both players are connected
      const bothConnected = Object.values(match.players).every(
        (p) => p.connected
      );

      if (bothConnected && match.status === 'waiting') {
        // Start the match!
        startTimer(roomId, io);

        io.to(roomId).emit('match-start', {
          message: 'Match started! Good luck!',
          startTime: match.timer.startTime,
        });

        console.log(`🚀 Match ${roomId} started!`);
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

      // Get user's match
      const match = getMatchByUserId(userId);

      if (!match) {
        return socket.emit('error', { message: 'You are not in a match' });
      }

      if (match.status !== 'in-progress') {
        return socket.emit('error', { message: 'Match is not in progress' });
      }

      // Update code in state
      updatePlayerCode(match.roomId, userId, code, language);

      
    } catch (error) {
      console.error('Error in code-update:', error);
      socket.emit('error', { message: 'Failed to update code' });
    }
  });
};

/**
 * Handle code submission (will be expanded in Part 5)
 */
export const handleCodeSubmit = (io, socket) => {
  socket.on('submit-code', async (data) => {
    try {
      const { code, language } = data;
      const userId = socket.user._id.toString();

      console.log(`📤 Submission from ${socket.user.name}`);

      // Validate match
      const match = getMatchByUserId(userId);
      if (!match) {
        return socket.emit('error', { message: 'You are not in a match' });
      }

      if (match.status !== 'in-progress') {
        return socket.emit('error', { message: 'Match is not in progress' });
      }

      // Validate code
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

      // Notify that submission is being processed
      socket.emit('submission-status', {
        status: 'processing',
        message: 'Running test cases...',
      });

      // Get problem details
      const problem = await Problem.findById(match.problemId);
      if (!problem) {
        return socket.emit('error', { message: 'Problem not found' });
      }

      console.log(`🧪 Running ${problem.testCases.length} test cases...`);

      // Run code against test cases
      const result = await runTestCases(code, language, problem.testCases);

      console.log(`✅ Result: ${result.verdict} (${result.passedTests}/${result.totalTests} passed)`);

      // Save submission to database
// Get match document from database (not in-memory state)
const matchDoc = await Match.findOne({ roomId: match.roomId });

if (matchDoc) {
  // Save submission to database
  await Submission.create({
    match: matchDoc._id,  // ← CORRECT: Use database ObjectId
    user: userId,
    problem: problem._id,
    code,
    language,
    verdict: result.verdict,
    submittedAt: new Date(),
  });
  console.log('💾 Submission saved to database');
}

      // Send result to player
      socket.emit('submission-result', {
        verdict: result.verdict,
        message: `${result.passedTests}/${result.totalTests} test cases passed`,
        testResults: result.testResults,
        allPassed: result.allTestsPassed,
      });

      // If ACCEPTED - First correct solution wins!
      if (result.verdict === 'Accepted') {
        console.log(`🏆 ${socket.user.name} solved the problem!`);

        // Check if this is the first player to solve
        const otherPlayerId = Object.keys(match.players).find(id => id !== userId);
        const otherPlayer = match.players[otherPlayerId];

        // Check if opponent already solved
        if (otherPlayer?.firstAcceptedAt) {
          console.log(`⚠️ Both players solved - ${socket.user.name} was second`);
          
          // Notify this player they were second
          socket.emit('match-result', {
            winner: otherPlayerId,
            message: 'Opponent solved first! You were second.',
            yourVerdict: 'Accepted',
          });
        } else {
          // This player wins!
          console.log(`🎉 ${socket.user.name} wins the match!`);

          // Update match state
          match.players[userId].firstAcceptedAt = Date.now();
          match.winner = userId;
          match.status = 'completed';
          stopTimer(match.roomId);

          // Update database
          await Match.findOneAndUpdate(
            { roomId: match.roomId },
            {
              winner: userId,
              status: 'completed',
              completedAt: new Date(),
              $set: {
                'players.$[elem].firstAcceptedAt': new Date(),
              }
            },
            {
              arrayFilters: [{ 'elem.user': userId }],
            }
          );
          const loserPlayerId = Object.keys(match.players).find(id => id !== userId);

          // Notify both players
          io.to(match.roomId).emit('match-end', {
            winner: userId,
            winnerName: socket.user.name,
            reason: 'first-correct-solution',
            message: `${socket.user.name} wins! First to solve correctly.`,
          });

          console.log(`🏁 Match ${match.roomId} completed. Winner: ${socket.user.name}`);
          deleteMatch(match.roomId);
console.log(`🗑️ Match ${match.roomId} deleted from memory`);
        }
      } else {
        // Wrong answer or error - notify player
        console.log(`❌ ${socket.user.name} - ${result.verdict}`);
        
        socket.emit('submission-result', {
          verdict: result.verdict,
          message: result.verdict === 'Wrong Answer' 
            ? `Wrong Answer - ${result.passedTests}/${result.totalTests} test cases passed`
            : result.verdict,
          testResults: result.testResults,
        });
      }

    } catch (error) {
      console.error('❌ Error in submit-code:', error);
      socket.emit('error', { message: 'Failed to process submission' });
    }
  });
};

/**
 * Handle player voluntarily leaving match
 */
export const  handleLeaveMatch = (io, socket) => {
  socket.on('leave-match', async(data) => {
    try {
      const { roomId } = data;
      const userId = socket.user._id.toString();

      console.log(`🚪 ${socket.user.name} is leaving match ${roomId}`);

      const match = getMatch(roomId);
      if (!match) return;

      // Find opponent
      const opponentId = Object.keys(match.players).find(id => id !== userId);

      if (opponentId && match.players[opponentId]?.connected) {
        // Stop timer
        stopTimer(roomId);

        // Opponent wins
        match.status = 'completed';
        match.winner = opponentId;

        // Notify opponent they won
        io.to(roomId).emit('match-end', {
          winner: opponentId,
          reason: 'opponent-left',
          message: 'You win! Opponent left the match.',
        });
        await updatePlayerStats(opponentId, userId);

        console.log(`🏆 Opponent wins - ${socket.user.name} left the match`);
      }

      // Delete match from memory
      deleteMatch(roomId);

    } catch (error) {
      console.error('❌ Error in leave-match:', error);
    }
  });
};
/**
 * Handle player disconnect
 */
/**
 * Handle player disconnect - to be called from index.js
 */
export const onPlayerDisconnect = (io, socket) => {
  console.log('🔌 onPlayerDisconnect called for:', socket.user.name);
  
  try {
    const userId = socket.user._id.toString();
    console.log('👤 User ID:', userId);
    
    const match = getMatchByUserId(userId);
    console.log('🎮 Match found:', match ? match.roomId : 'NULL');

    if (!match) {
      console.log('⚠️ No active match for this user');
      return;
    }

    console.log(`🔌 ${socket.user.name} disconnected from match ${match.roomId}`);

    // Mark player as disconnected
    if (match.players[userId]) {
      match.players[userId].connected = false;
      console.log('✅ Player marked as disconnected');
    }

    // Wait 3 seconds before notifying opponent (gives time for refresh/reconnect)
    setTimeout(() => {
      const currentMatch = getMatch(match.roomId);
      if (!currentMatch) return;

      // Check if player is STILL disconnected after 3 seconds
      if (!currentMatch.players[userId]?.connected) {
        console.log('📤 Player still disconnected after 3s, notifying opponent');
        
        // NOW notify opponent
        io.to(match.roomId).emit('opponent-disconnected', {
          userId,
          message: `${socket.user.name} disconnected`,
        });
      } else {
        console.log('✅ Player reconnected within 3s, no notification sent');
      }
    }, 3000); // 3-second buffer

    // Grace period: 30 seconds to reconnect (starts immediately, not after 3s)
    setTimeout(async () => {
      const currentMatch = getMatch(match.roomId);
      if (!currentMatch) return;

      // Check if player reconnected
      if (!currentMatch.players[userId]?.connected) {
        // Player didn't reconnect - forfeit
        console.log(`⏰ ${socket.user.name} did not reconnect. Forfeiting...`);

        // Find opponent
        const opponentId = Object.keys(currentMatch.players).find(
          (id) => id !== userId
        );

        if (opponentId && currentMatch.players[opponentId]?.connected) {
          // Opponent wins
          currentMatch.winner = opponentId;
          currentMatch.status = 'completed';
          stopTimer(match.roomId);

          io.to(match.roomId).emit('match-end', {
            winner: opponentId,
            reason: 'opponent-disconnected',
            message: 'You win! Opponent disconnected.',
          });
          await updatePlayerStats(opponentId, userId);
           deleteMatch(match.roomId);
  console.log(`🗑️ Match ${match.roomId} deleted after disconnect forfeit`);
        } else {
          // Both disconnected - match abandoned
          currentMatch.status = 'abandoned';
          stopTimer(match.roomId);
          deleteMatch(match.roomId);
  console.log(`🗑️ Match ${match.roomId} deleted - both players disconnected`);
        }
      }
    }, 30000); // 30 seconds grace period
  } catch (error) {
    console.error('❌ Error in onPlayerDisconnect:', error);
  }
};

