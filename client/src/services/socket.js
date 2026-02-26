import { io } from 'socket.io-client';

// In production: empty (proxied through Render). In local dev: direct URL
const SOCKET_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000')
  : '';

let socket = null;

/**
 * Connect to Socket.io server with JWT token
 */
export const connectSocket = (token) => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    autoConnect: false,
  });

  // Connection events
  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.connect();

  // TESTING: Expose to window (REMOVE IN PRODUCTION)
  if (typeof window !== 'undefined') {
    window.socket = socket;
    console.log('🧪 Socket exposed to window.socket for testing');
  }

  return socket;
};

/**
 * Disconnect from Socket.io server
 */
export const disconnectSocket = () => {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
    if (typeof window !== 'undefined') {
      window.socket = null;
    }
  }
};

/**
 * Get current socket instance
 */
export const getSocket = () => {
  return socket;
};

export default {
  connectSocket,
  disconnectSocket,
  getSocket,
};