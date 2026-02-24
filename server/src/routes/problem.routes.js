import express from 'express';
import { Problem } from '../models/Problem.model.js';
import { Submission } from '../models/Submission.model.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/problems
 * List all problems (title, difficulty, test case count) — no hidden test data.
 */
router.get('/', async (req, res) => {
    try {
        const { difficulty, limit = 50, skip = 0 } = req.query;
        const filter = {};
        if (difficulty) filter.difficulty = difficulty.toLowerCase();

        const problems = await Problem.find(filter)
            .select('title difficulty testCases languagesAllowed timeLimit memoryLimit createdAt')
            .skip(Number(skip))
            .limit(Number(limit))
            .lean();

        const total = await Problem.countDocuments(filter);

        const formatted = problems.map((p) => ({
            id: p._id,
            title: p.title,
            difficulty: p.difficulty,
            totalTestCases: p.testCases.length,
            sampleTestCases: p.testCases.filter((t) => !t.isHidden),
            languagesAllowed: p.languagesAllowed,
            timeLimit: p.timeLimit,
            memoryLimit: p.memoryLimit,
            createdAt: p.createdAt,
        }));

        res.json({ success: true, total, problems: formatted });
    } catch (error) {
        console.error('❌ GET /api/problems error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * POST /api/problems
 * Create a new problem (Admin only).
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, difficulty, timeLimit, memoryLimit, languagesAllowed, testCases } = req.body;

        if (!title || !description) {
            return res.status(400).json({ success: false, message: 'Title and description are required' });
        }

        const newProblem = new Problem({
            title,
            description,
            difficulty: difficulty || 'medium',
            timeLimit: timeLimit || 2,
            memoryLimit: memoryLimit || 256,
            languagesAllowed: languagesAllowed || [71, 63, 62, 54, 50, 998, 999],
            testCases: testCases || [],
        });

        await newProblem.save();

        res.status(201).json({ success: true, problem: newProblem });
    } catch (error) {
        console.error('❌ POST /api/problems error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * GET /api/problems/:id
 * Get a single problem by its MongoDB _id.
 * Hidden test cases are NOT returned (they stay server-side for judging).
 */
router.get('/:id', async (req, res) => {
    try {
        const problem = await Problem.findById(req.params.id).lean();
        if (!problem) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }

        res.json({
            success: true,
            problem: {
                id: problem._id,
                title: problem.title,
                description: problem.description,
                difficulty: problem.difficulty,
                sampleTestCases: problem.testCases.filter((t) => !t.isHidden),
                totalTestCases: problem.testCases.length,
                languagesAllowed: problem.languagesAllowed,
                timeLimit: problem.timeLimit,
                memoryLimit: problem.memoryLimit,
            },
        });
    } catch (error) {
        console.error('❌ GET /api/problems/:id error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * GET /api/problems/daily
 * Get today's daily challenge problem (public)
 * Uses date-based seed to deterministically pick a problem each day
 */
router.get('/daily', async (req, res) => {
    try {
        const problems = await Problem.find().select('title difficulty').lean();

        if (problems.length === 0) {
            return res.json({
                success: true,
                problem: null,
                message: 'No problems available',
            });
        }

        // Deterministic daily selection based on today's date
        const today = new Date();
        const seed = today.getFullYear() * 10000
            + (today.getMonth() + 1) * 100
            + today.getDate();
        const index = seed % problems.length;
        const dailyProblem = problems[index];

        // Count submissions for this problem
        const solvedCount = await Submission.countDocuments({
            problem: dailyProblem._id,
            verdict: 'Accepted',
        });

        res.json({
            success: true,
            problem: {
                id: dailyProblem._id,
                title: dailyProblem.title,
                difficulty: dailyProblem.difficulty,
                solvedCount,
                date: today.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
            },
        });
    } catch (error) {
        console.error('❌ Daily challenge error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
