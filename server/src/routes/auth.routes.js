import express from 'express';
import { googleAuth, register, login, getCurrentUser, verifyOtp, resendOtp, forgotPasswordController, resetPasswordController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authRateLimit } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// POST /api/auth/google - Login with Google (public) — no rate limit
router.post('/google', googleAuth);

// Auth rate limit: 10 requests per 15 min per IP for login/register/otp
const authLimiter = authRateLimit(10, 900);

// POST /api/auth/register - Register (sends OTP); no JWT until verified
router.post('/register', authLimiter, register);

// POST /api/auth/login - Login with email + password only
router.post('/login', authLimiter, login);

// POST /api/auth/verify-otp - Verify signup OTP; returns token + user
router.post('/verify-otp', authLimiter, verifyOtp);

// POST /api/auth/resend-otp - Resend signup verification OTP
router.post('/resend-otp', authLimiter, resendOtp);

// POST /api/auth/forgot-password - Request password reset email
router.post('/forgot-password', authLimiter, forgotPasswordController);

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', authLimiter, resetPasswordController);

// GET /api/auth/me - Get current user (protected)
router.get('/me', authenticateToken, getCurrentUser);

export default router;