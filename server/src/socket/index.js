import { Server } from 'socket.io';
import { socketAuthMiddleware } from './middleware.js';
import { getRedisSubscriber } from '../config/redis.js';
import {
  handleJoinMatch,
  handleCodeUpdate,
  handleCodeSubmit,
  onPlayerDisconnect,
  handleLeaveMatch,
  handlePostMatchChat,
} from './match.handler.js';
import {
  handleJoinQueue,
  handleLeaveQueue,
  handleQueueDisconnect,
  handlePrivateRoom,
} from './matchmaking.handler.js';
import {
  handleJoinContest,
  handleLeaveContest,
  handleContestSubmit,
  handleContestLeaderboard,
  onContestDisconnect,
} from './contest.handler.js';

let io = null;

// In-memory map of currently connected users: userId (string) -> { name, socketId }
export const onlineUsers = new Map();

export const initializeSocket = (server) => {
  const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:3003',
    'http://localhost:5173',
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  console.log('✅ Socket.io initialized with authentication');

  io.on('connection', (socket) => {
    const uid = socket.user._id.toString();
    console.log(`🔌 Client connected: ${socket.id} (User: ${socket.user.name})`);
    onlineUsers.set(uid, { name: socket.user.name, socketId: socket.id });
    // Join personal room so we can target this user without tracking socketId
    socket.join(uid);
    // Send current count to the connecting socket immediately
    socket.emit('player-count', { count: onlineUsers.size });
    // Notify all connected clients that this user is now online
    io.emit('user-online', { userId: uid, count: onlineUsers.size });

    // Matchmaking handlers
    handleJoinQueue(io, socket);
    handleLeaveQueue(io, socket);
    handlePrivateRoom(io, socket);

    // Match handlers
    handleJoinMatch(io, socket);
    handleCodeUpdate(io, socket);
    handleCodeSubmit(io, socket);
    handleLeaveMatch(io, socket);
    handlePostMatchChat(io, socket);

    // Contest handlers
    handleJoinContest(io, socket);
    handleLeaveContest(io, socket);
    handleContestSubmit(io, socket);
    handleContestLeaderboard(io, socket);

    console.log('✅ Registering disconnect handler for:', socket.user.name);
    // Disconnect handler
    socket.on('disconnect', () => {
      onlineUsers.delete(uid);
      // Notify all connected clients that this user is now offline
      io.emit('user-offline', { userId: uid, count: onlineUsers.size });
      console.log('🔌 DISCONNECT FIRED for:', socket.user.name);
      handleQueueDisconnect(socket);
      onPlayerDisconnect(io, socket);
      onContestDisconnect(io, socket);
    });
  });

  // Cross-Process Socket Emission (for isolated Worker processes)
  try {
    const subscriber = getRedisSubscriber();
    subscriber.subscribe('socket-emits', (err) => {
      if (err) console.error('❌ Redis Pub/Sub failed to subscribe to socket-emits', err);
    });

    subscriber.on('message', (channel, message) => {
      if (channel === 'socket-emits') {
        try {
          console.log(`📡 [Redis PubSub] Received emit:`, message);
          const { userId, room, event, data } = JSON.parse(message);
          if (userId) io.to(userId).emit(event, data);
          if (room) io.to(room).emit(event, data);
        } catch (e) {
          console.error('Failed to parse socket-emits payload:', e);
        }
      }
    });
    console.log('✅ Socket.io Redis Pub/Sub listener active');
  } catch (err) {
    console.warn('⚠️ Could not connect Redis Pub/Sub for sockets', err);
  }

  return io;
};

/**
 * Get Socket.io instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};