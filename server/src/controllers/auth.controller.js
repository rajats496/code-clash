import {
  verifyGoogleToken,
  verifyGoogleAccessToken,
  findOrCreateUser,
  generateJWT,
  registerWithEmail,
  loginWithEmail,
  sendGmailOtp,
  verifyGmailOtp as verifyGmailOtpService,
} from '../services/auth.service.js';

/**
 * POST /api/auth/google
 * Login/Register with Google OAuth
 */
export const googleAuth = async (req, res) => {
  try {
    const { token, tokenType } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const googleUser = tokenType === 'access_token'
      ? await verifyGoogleAccessToken(token)
      : await verifyGoogleToken(token);
    const user = await findOrCreateUser(googleUser);
    const jwtToken = generateJWT(user);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
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
 * POST /api/auth/register
 * Register with email + password
 */
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const user = await registerWithEmail({ name, email, password, role });
    const jwtToken = generateJWT(user);

    res.status(201).json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        rating: user.rating,
        matchesPlayed: user.matchesPlayed,
        matchesWon: user.matchesWon,
      },
    });
  } catch (error) {
    console.error('Register error:', error.message);
    const status = error.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ error: error.message });
  }
};

/**
 * POST /api/auth/login
 * Login with email + password
 */
export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await loginWithEmail({ email, password, role });
    const jwtToken = generateJWT(user);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        rating: user.rating,
        matchesPlayed: user.matchesPlayed,
        matchesWon: user.matchesWon,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: error.message });
  }
};

/**
 * POST /api/auth/gmail-otp/request
 * Request OTP sent to Gmail address
 */
export const requestGmailOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    await sendGmailOtp(email);
    res.json({ success: true, message: 'OTP sent to your Gmail.' });
  } catch (error) {
    console.error('Gmail OTP request error:', error.message);
    const status = error.message.includes('wait') ? 429 : 400;
    res.status(status).json({ error: error.message });
  }
};

/**
 * POST /api/auth/gmail-otp/verify
 * Verify OTP and return token + user (same shape as /login)
 */
export const verifyGmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }
    const user = await verifyGmailOtpService(email, otp);
    const jwtToken = generateJWT(user);
    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        rating: user.rating,
        matchesPlayed: user.matchesPlayed,
        matchesWon: user.matchesWon,
      },
    });
  } catch (error) {
    console.error('Gmail OTP verify error:', error.message);
    res.status(401).json({ error: error.message });
  }
};

/**
 * GET /api/auth/me
 * Get current user info (requires JWT)
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        rating: user.rating,
        matchesPlayed: user.matchesPlayed,
        matchesWon: user.matchesWon,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};