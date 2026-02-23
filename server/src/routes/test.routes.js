import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { createMatch } from '../socket/matchState.js';
import { executeCode } from '../services/mock-execution.service.js';

const router = express.Router();

/**
 * POST /api/test/create-match
 * Create a test match for development
 */
router.post('/create-match', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const roomId = `test-room-${Date.now()}`;
    
    const match = createMatch(roomId, userId, userId, 'test-problem-id');

    console.log(`✅ Test match created: ${roomId}`);

    res.json({
      success: true,
      roomId,
      message: 'Test match created successfully',
    });
  } catch (error) {
    console.error('❌ Error creating test match:', error);
    res.status(500).json({ error: error.message || 'Failed to create test match' });
  }
});

/**
 * POST /api/test/mock
 * Test Mock Execution Service
 */
router.post('/mock', authenticateToken, async (req, res) => {
  try {
    console.log('🎭 Testing Mock Execution...');

    const code = 'print("Hello from Mock Execution!")';
    const languageId = 71; // Python

    const result = await executeCode(code, languageId);

    res.json({
      success: true,
      message: 'Mock Execution working!',
      result: {
        verdict: result.verdict,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      },
    });
  } catch (error) {
    console.error('❌ Mock test failed:', error);
    res.status(500).json({ 
      error: error.message || 'Mock test failed' 
    });
  }
});

export default router;