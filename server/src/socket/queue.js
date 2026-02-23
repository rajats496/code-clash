/**
 * In-memory FIFO matchmaking queue
 * For production with multiple servers, use Redis + pub/sub
 */

// Queue: array of { userId, socketId, rating, name, picture, totalRounds, joinedAt }
const matchmakingQueue = [];

// Map: userId -> queue position (for quick duplicate checks)
const userInQueue = new Map();

/**
 * Add player to queue
 * @returns {number} - Queue position (0-indexed)
 */
export const addToQueue = (userId, socketId, rating = 1200, name = 'Player', picture = '', totalRounds = 1) => {
  if (userInQueue.has(userId)) {
    throw new Error('Already in queue');
  }

  const player = {
    userId,
    socketId,
    rating,
    name,
    picture,
    totalRounds,
    joinedAt: Date.now(),
  };

  matchmakingQueue.push(player);
  userInQueue.set(userId, matchmakingQueue.length - 1);

  console.log(`➕ ${name} joined queue (Best of ${totalRounds}). Position: ${matchmakingQueue.length}`);

  return matchmakingQueue.length - 1;
};

/**
 * Remove player from queue
 * @returns {boolean}
 */
export const removeFromQueue = (userId) => {
  const index = userInQueue.get(userId);

  if (index === undefined) {
    return false;
  }

  matchmakingQueue.splice(index, 1);
  userInQueue.delete(userId);

  for (let i = index; i < matchmakingQueue.length; i++) {
    userInQueue.set(matchmakingQueue[i].userId, i);
  }

  console.log(`➖ ${userId} left queue. Remaining: ${matchmakingQueue.length}`);

  return true;
};

/**
 * Try to match two players with the same totalRounds preference
 * @returns {Object|null} - { player1, player2 } or null
 */
export const tryMatchPlayers = () => {
  if (matchmakingQueue.length < 2) {
    return null;
  }

  // Try to find two players with matching totalRounds
  for (let i = 0; i < matchmakingQueue.length; i++) {
    for (let j = i + 1; j < matchmakingQueue.length; j++) {
      if (matchmakingQueue[i].totalRounds === matchmakingQueue[j].totalRounds) {
        // Found a pair! Remove them from queue (j first since it's a higher index)
        const player2 = matchmakingQueue.splice(j, 1)[0];
        const player1 = matchmakingQueue.splice(i, 1)[0];

        userInQueue.delete(player1.userId);
        userInQueue.delete(player2.userId);

        // Rebuild positions for remaining players
        matchmakingQueue.forEach((player, index) => {
          userInQueue.set(player.userId, index);
        });

        console.log(`✅ Matched: ${player1.userId} vs ${player2.userId} (Best of ${player1.totalRounds})`);

        return { player1, player2 };
      }
    }
  }

  return null; // No matching pair found
};

/**
 * Check if user is in queue
 */
export const isInQueue = (userId) => {
  return userInQueue.has(userId);
};

/**
 * Get queue status (for debugging)
 */
export const getQueueStatus = () => {
  return {
    length: matchmakingQueue.length,
    players: matchmakingQueue.map((p) => ({
      userId: p.userId,
      rating: p.rating,
      totalRounds: p.totalRounds,
      waitTime: Date.now() - p.joinedAt,
    })),
  };
};

/**
 * Get user's position in queue
 */
export const getQueuePosition = (userId) => {
  return userInQueue.get(userId);
};