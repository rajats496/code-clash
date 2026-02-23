import { verifyJWT } from '../services/auth.service.js';
import { User } from '../models/User.model.js';

/**
 * Middleware to verify JWT token in Socket.io connections
 * Expects: socket.handshake.auth.token
 */
export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT
    const decoded = verifyJWT(token);

    // Fetch user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Attach user to socket object
    socket.user = user;
    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};