import express from 'express';
import { googleAuth, getCurrentUser } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// POST /api/auth/google - Login with Google (public)
router.post('/google', googleAuth);

// GET /api/auth/me - Get current user (protected)
router.get('/me', authenticateToken, getCurrentUser);

export default router;