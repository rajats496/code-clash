/**
 * In-memory storage for active matches
 * In production, you'd use Redis for multi-server scaling
 */

// Map: roomId -> matchState
const activeMatches = new Map();

// Map: userId -> roomId (for quick lookup)
const userToRoom = new Map();

// Map: socketId -> userId (for disconnect handling)
const socketToUser = new Map();

/**
 * Create a new match state (supports multi-round)
 */
export const createMatch = (roomId, player1Id, player2Id, problemIds, totalRounds = 1) => {
  const matchState = {
    roomId,
    problemIds,                     // array of problem IDs
    totalRounds,
    currentRound: 0,                // 0-indexed
    players: {
      [player1Id]: {
        userId: player1Id,
        socketId: null,
        code: '',
        language: 71,
        connected: false,
        solvedCount: 0,
        // Per-round tracking: { solved, solveTime, wrongSubmissions }
        roundResults: problemIds.map(() => ({
          solved: false,
          solveTime: null,
          wrongSubmissions: 0,
        })),
        // Legacy fields (used for current round)
        firstAcceptedAt: null,
        wrongSubmissions: 0,
      },
      [player2Id]: {
        userId: player2Id,
        socketId: null,
        code: '',
        language: 71,
        connected: false,
        solvedCount: 0,
        roundResults: problemIds.map(() => ({
          solved: false,
          solveTime: null,
          wrongSubmissions: 0,
        })),
        firstAcceptedAt: null,
        wrongSubmissions: 0,
      },
    },
    // Per-round start times (set when each round begins)
    roundStartTimes: [],
    timer: {
      startTime: null,
      currentTime: 0,
      isRunning: false,
      intervalId: null,
    },
    status: 'waiting',
    winner: null,
    createdAt: Date.now(),
  };

  activeMatches.set(roomId, matchState);
  userToRoom.set(player1Id, roomId);
  userToRoom.set(player2Id, roomId);

  return matchState;
};

/**
 * Get match state by roomId
 */
export const getMatch = (roomId) => {
  return activeMatches.get(roomId);
};

/**
 * Get match state by userId
 */
export const getMatchByUserId = (userId) => {
  const roomId = userToRoom.get(userId);
  return roomId ? activeMatches.get(roomId) : null;
};

/**
 * Update player socket connection
 */
export const connectPlayer = (roomId, userId, socketId) => {
  const match = activeMatches.get(roomId);
  if (!match) return null;

  if (match.players[userId]) {
    match.players[userId].socketId = socketId;
    match.players[userId].connected = true;
    socketToUser.set(socketId, userId);
  }

  return match;
};

/**
 * Handle player disconnect
 */
export const disconnectPlayer = (socketId) => {
  const userId = socketToUser.get(socketId);
  if (!userId) return null;

  const roomId = userToRoom.get(userId);
  if (!roomId) return null;

  const match = activeMatches.get(roomId);
  if (!match) return null;

  if (match.players[userId]) {
    match.players[userId].connected = false;
    match.players[userId].socketId = null;
  }

  socketToUser.delete(socketId);

  return { match, userId };
};

/**
 * Update player code
 */
export const updatePlayerCode = (roomId, userId, code, language) => {
  const match = activeMatches.get(roomId);
  if (!match || !match.players[userId]) return null;

  match.players[userId].code = code;
  match.players[userId].language = language;

  return match;
};

/**
 * Advance to next round — resets per-round player state
 */
export const advanceRound = (roomId) => {
  const match = activeMatches.get(roomId);
  if (!match) return null;

  match.currentRound += 1;

  // Reset per-round player state
  Object.values(match.players).forEach((p) => {
    p.code = '';
    p.firstAcceptedAt = null;
    p.wrongSubmissions = 0;
  });

  // Record round start time
  match.roundStartTimes[match.currentRound] = Date.now();

  return match;
};

/**
 * Start match timer
 */
export const startTimer = (roomId, io) => {
  const match = activeMatches.get(roomId);
  if (!match) {
    console.log(`❌ Cannot start timer: Match ${roomId} not found`);
    return null;
  }

  if (match.timer.isRunning) {
    console.log(`⚠️ Timer already running for ${roomId}`);
    return match;
  }

  match.timer.startTime = Date.now();
  match.timer.isRunning = true;
  match.status = 'in-progress';

  // Record first round start time
  match.roundStartTimes[0] = Date.now();

  console.log(`⏱️ Timer started for match ${roomId}`);

  match.timer.intervalId = setInterval(() => {
    const elapsed = Math.floor((Date.now() - match.timer.startTime) / 1000);
    match.timer.currentTime = elapsed;

    io.to(roomId).emit('timer-update', {
      startTime: match.timer.startTime,   // epoch ms — clients derive elapsed from this
      currentTime: elapsed,               // kept for fallback / DB
      isRunning: true,
    });
  }, 5000); // broadcast every 5s for sync only — clients calculate locally

  return match;
};

/**
 * Stop match timer
 */
export const stopTimer = (roomId) => {
  const match = activeMatches.get(roomId);
  if (!match) return null;

  match.timer.isRunning = false;
  if (match.timer.intervalId) {
    clearInterval(match.timer.intervalId);
    match.timer.intervalId = null;
  }

  return match;
};

/**
 * Delete match from state
 */
export const deleteMatch = (roomId) => {
  const match = activeMatches.get(roomId);
  if (!match) return null;

  if (match.timer.intervalId) {
    clearInterval(match.timer.intervalId);
  }

  activeMatches.delete(roomId);

  Object.keys(match.players).forEach((userId) => {
    userToRoom.delete(userId);
  });

  console.log(`🗑️ Match ${roomId} deleted from memory`);
  return match;
};

/**
 * Get all active matches (for debugging)
 */
export const getAllMatches = () => {
  return Array.from(activeMatches.values());
};

/**
 * Get user's current room ID
 */
export const getUserRoom = (userId) => {
  return userToRoom.get(userId);
};