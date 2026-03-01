import {
  verifyGoogleToken,
  verifyGoogleAccessToken,
  findOrCreateUser,
  generateJWT,
  registerWithEmail,
  loginWithEmail,
  verifySignupOtp,
  resendSignupOtp,
  forgotPassword,
  resetPassword as resetPasswordService,
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
 * Register with email + password; sends OTP. No JWT until OTP verified.
 */
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const { user, message } = await registerWithEmail({ name, email, password, role });

    res.status(201).json({
      success: true,
      message,
      email: user.email,
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
 * POST /api/auth/verify-otp
 * Verify signup OTP; returns token + user (same shape as /login)
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }
    const user = await verifySignupOtp(email, otp);
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
    console.error('Verify OTP error:', error.message);
    res.status(401).json({ error: error.message });
  }
};

/**
 * POST /api/auth/resend-otp
 * Resend signup verification OTP (rate limited per email)
 */
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    await resendSignupOtp(email);
    res.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error('Resend OTP error:', error.message);
    const status = error.message.includes('wait') ? 429 : 400;
    res.status(status).json({ error: error.message });
  }
};

/**
 * POST /api/auth/forgot-password
 * Request password reset email (same response whether email exists or not)
 */
export const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const result = await forgotPassword(email);
    res.json(result);
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

/**
 * POST /api/auth/reset-password
 * Reset password with token from email link
 */
export const resetPasswordController = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    await resetPasswordService(token, newPassword);
    res.json({ success: true, message: 'Password has been reset. You can sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(400).json({ error: error.message || 'Invalid or expired reset link.' });
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