import {
  verifyGoogleToken,
  findOrCreateUser,
  generateJWT,
} from '../services/auth.service.js';

/**
 * POST /api/auth/google
 * Login/Register with Google OAuth
 */
export const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Step 1: Verify token with Google
    const googleUser = await verifyGoogleToken(token);

    // Step 2: Find or create user in our database
    const user = await findOrCreateUser(googleUser);

    // Step 3: Generate our JWT
    const jwtToken = generateJWT(user);

    // Step 4: Return user info + JWT
    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        rating: user.rating,
        matchesPlayed: user.matchesPlayed,
        matchesWon: user.matchesWon,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
};

/**
 * GET /api/auth/me
 * Get current user info (requires JWT)
 */
export const getCurrentUser = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = req.user;

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        rating: user.rating,
        matchesPlayed: user.matchesPlayed,
        matchesWon: user.matchesWon,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};