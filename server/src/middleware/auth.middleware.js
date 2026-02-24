import { verifyJWT } from '../services/auth.service.js';
import { User } from '../models/User.model.js';

/**
 * Middleware to verify JWT token in REST API requests
 * Expects: Authorization: Bearer <token>
 */
export const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1]; // "Bearer TOKEN" -> "TOKEN"

    // Verify token
    const decoded = verifyJWT(token);

    // Fetch full user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware to restrict access to admin users only.
 * Must be used AFTER authenticateToken.
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
