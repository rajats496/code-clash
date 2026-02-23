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

    // ADD THIS LINE TEMPORARILY
    console.log('🔑 JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES - ' + process.env.JWT_SECRET.substring(0, 10) + '...' : 'NO - UNDEFINED');
    
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
