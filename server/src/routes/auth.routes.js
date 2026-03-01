import express from 'express';
import { googleAuth, register, login, getCurrentUser, requestGmailOtp, verifyGmailOtp } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// POST /api/auth/google - Login with Google (public)
router.post('/google', googleAuth);

// POST /api/auth/register - Register with email + password (public)
router.post('/register', register);

// POST /api/auth/login - Login with email + password (public)
router.post('/login', login);

// POST /api/auth/gmail-otp/request - Request OTP to Gmail (public)
router.post('/gmail-otp/request', requestGmailOtp);
// POST /api/auth/gmail-otp/verify - Verify OTP and login (public)
router.post('/gmail-otp/verify', verifyGmailOtp);

// GET /api/auth/me - Get current user (protected)
router.get('/me', authenticateToken, getCurrentUser);

export default router;