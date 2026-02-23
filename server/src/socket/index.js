import { Server } from 'socket.io';
import { socketAuthMiddleware } from './middleware.js';
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

let io = null;

// In-memory map of currently connected users: userId (string) -> { name, socketId }
export const onlineUsers = new Map();

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3003',
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
 console.log('✅ Registering disconnect handler for:', socket.user.name);
    // Disconnect handler
    socket.on('disconnect', () => {
      onlineUsers.delete(uid);
      // Notify all connected clients that this user is now offline
      io.emit('user-offline', { userId: uid, count: onlineUsers.size });
  console.log('🔌 DISCONNECT FIRED for:', socket.user.name);
  handleQueueDisconnect(socket);
  onPlayerDisconnect(io, socket); // ← CORRECT - calls logic directly
});
  });

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