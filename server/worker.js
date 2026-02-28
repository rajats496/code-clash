import dotenv from 'dotenv';
dotenv.config();

import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import { createRedisConnection, getRedisClient } from './src/config/redis.js';
import { runTestCases } from './src/services/contest-execution.service.js';
import { ContestSubmission } from './src/models/ContestSubmission.model.js';
import { Contest } from './src/models/Contest.model.js';
import { Problem } from './src/models/Problem.model.js';
import { updateLeaderboard, getLeaderboard } from './src/services/leaderboard.service.js';
import { User } from './src/models/User.model.js';

const QUEUE_NAME = 'contest-submissions';
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '10');

// ─────────────────────────────────────────────
//  Socket.io emission helpers (Cross-Process Pub/Sub)
// ─────────────────────────────────────────────
const emitSubmissionResult = (userId, contestId, result) => {
    try {
        const redis = getRedisClient();
        redis.publish('socket-emits', JSON.stringify({
            userId: userId.toString(),
            event: 'contest-submission-result',
            data: { contestId, ...result }
        }));
    } catch (err) {
        console.error('Failed to emit submission result via Redis:', err.message);
    }
};

const emitLeaderboardUpdate = async (contestId) => {
    try {
        const redis = getRedisClient();

        // Read top 20 leaderboard entries from Redis (no REST call needed for clients)
        const contest = await Contest.findById(contestId).select('scoringType').lean();
        if (!contest) return;

        const entries = await getLeaderboard(contestId, contest.scoringType, 0, 20);

        // Enrich with user info from MongoDB
        if (entries.length > 0) {
            const userIds = entries.map(e => e.userId);
            const users = await User.find(
                { _id: { $in: userIds } },
                'name picture rating'
            ).lean();

            const userMap = {};
            users.forEach(u => { userMap[u._id.toString()] = u; });

            entries.forEach(entry => {
                const user = userMap[entry.userId];
                if (user) {
                    entry.name = user.name;
                    entry.picture = user.picture;
                    entry.rating = user.rating;
                }
            });
        }

        // Push complete leaderboard data via socket — clients use it directly
        redis.publish('socket-emits', JSON.stringify({
            room: `contest-${contestId}`,
            event: 'contest-leaderboard-update',
            data: { contestId, leaderboard: entries, timestamp: Date.now() }
        }));
    } catch (err) {
        console.error('Failed to emit leaderboard update via Redis:', err.message);
        // Fallback: emit without data so clients fetch via REST
        try {
            const redis = getRedisClient();
            redis.publish('socket-emits', JSON.stringify({
                room: `contest-${contestId}`,
                event: 'contest-leaderboard-update',
                data: { contestId, timestamp: Date.now() }
            }));
        } catch { /* ignore */ }
    }
};

// ─────────────────────────────────────────────
//  Handle failed jobs
// ─────────────────────────────────────────────
const handleFailedJob = async (job, err) => {
    if (!job) return;

    const { submissionId, userId, contestId, problemId } = job.data;

    // We only touch the DB for actual submissions (not sample runs)
    if (submissionId !== 'temp_run') {
        await ContestSubmission.findByIdAndUpdate(submissionId, {
            status: 'failed',
            verdict: 'Internal Error',
            judgedAt: new Date(),
        });
    }

    emitSubmissionResult(userId, contestId, {
        submissionId,
        problemId,
        verdict: 'Internal Error',
        error: 'Judging failed. Please try again.',
    });
};

// ─────────────────────────────────────────────
//  Handle Accepted submission
// ─────────────────────────────────────────────
const handleAcceptedSubmission = async (contestId, userId, problemId, solveTimeSeconds) => {
    const contest = await Contest.findById(contestId).select('problems scoringType wrongSubmissionPenalty').lean();
    if (!contest) return;

    const redis = getRedisClient();
    const userKey = `contest:${contestId}:user:${userId}`;
    const solvedField = `solved_${problemId}`;

    // 1. Atomically mark as solved. HSETNX returns 1 if newly set, 0 if already existed.
    const isNewlySolved = await redis.hsetnx(userKey, solvedField, solveTimeSeconds.toString());
    if (isNewlySolved === 0) return; // Already solved, ignore newly received correct submission

    // 2. Fetch required configuration & past attempts from Redis
    const attemptsField = `attempts_${problemId}`;
    const attemptsStr = await redis.hget(userKey, attemptsField);
    const attempts = parseInt(attemptsStr || '0', 10);

    // 3. Calculate penalty and points
    const penaltyMinutes = contest.wrongSubmissionPenalty || 20;
    const penaltyTime = solveTimeSeconds + (attempts * penaltyMinutes * 60);

    const problemConfig = contest.problems.find(
        (p) => p.problem.toString() === problemId.toString()
    );
    const basePoints = problemConfig?.points || 100;
    // Decrease points slightly for each wrong attempt
    const pointsEarned = Math.round(basePoints / (1 + attempts * 0.1));

    // 4. Update real-time aggregates atomically in Redis
    const totalSolved = await redis.hincrby(userKey, 'totalSolved', 1);
    const totalPenalty = await redis.hincrby(userKey, 'totalPenalty', penaltyTime);
    const totalPoints = await redis.hincrby(userKey, 'totalPoints', pointsEarned);

    // Set TTL on user hash (1 week) so it cleans up after contest
    await redis.expire(userKey, 86400 * 7);

    // 5. Update Redis Leaderboard for fast ZREVRANGE
    await updateLeaderboard(contestId, userId, {
        solved: totalSolved,
        penalty: totalPenalty,
        points: totalPoints,
        scoringType: contest.scoringType,
    });

    // 6. Push 'solved' status to MongoDB for the initial ContestArena fetch
    try {
        await Contest.updateOne(
            { _id: contestId, "participants.user": userId },
            {
                $set: {
                    "participants.$[part].problemStatus.$[prob].solved": true,
                    "participants.$[part].problemStatus.$[prob].solveTime": solveTimeSeconds
                }
            },
            {
                arrayFilters: [
                    { "part.user": new mongoose.Types.ObjectId(userId) },
                    { "prob.problem": new mongoose.Types.ObjectId(problemId) }
                ]
            }
        );
    } catch (dbErr) {
        console.error('Failed to update MongoDB problemStatus:', dbErr.message);
    }

    // Emit event back to clients
    emitLeaderboardUpdate(contestId);
};

// ─────────────────────────────────────────────
//  Increment wrong attempts
// ─────────────────────────────────────────────
const incrementWrongAttempts = async (contestId, userId, problemId) => {
    const redis = getRedisClient();
    const userKey = `contest:${contestId}:user:${userId}`;

    // Verify user hasn't already solved it. We don't penalize submissions after solving.
    const solvedField = `solved_${problemId}`;
    const isSolved = await redis.hget(userKey, solvedField);
    if (isSolved) return;

    // Rapid HINCRBY in Redis instead of MongoDB array modification
    const attemptsField = `attempts_${problemId}`;
    await redis.hincrby(userKey, attemptsField, 1);
};


// ─────────────────────────────────────────────
//  Process a single submission (Worker logic)
// ─────────────────────────────────────────────
const processSubmission = async (job) => {
    const {
        submissionId,
        contestId,
        userId,
        problemId,
        sourceCode,
        languageId,
        contestTime,
        isSubmit,
    } = job.data;

    console.log(`⚡ Processing submission ${submissionId} for contest ${contestId}`);

    try {
        // 1. Get problem test cases
        const problem = await Problem.findById(problemId);
        if (!problem) {
            throw new Error(`Problem ${problemId} not found`);
        }

        // 2. Run code against test cases (all if submit, only visible if run)
        const testCasesToRun = isSubmit ? problem.testCases : problem.testCases.filter(tc => !tc.isHidden);
        const result = await runTestCases(sourceCode, languageId, testCasesToRun);

        // 3. Update submission in DB (only for real submits)
        if (isSubmit && submissionId !== 'temp_run') {
            await ContestSubmission.findByIdAndUpdate(
                submissionId,
                {
                    status: 'completed',
                    verdict: result.verdict,
                    testResults: result.testResults,
                    totalTests: result.totalTests,
                    passedTests: result.passedTests,
                    executionTime: result.runtime,
                    memoryUsed: result.memory,
                    judgedAt: new Date(),
                },
                { new: true }
            );

            // 4. If Accepted, update contest leaderboard
            if (result.verdict === 'Accepted') {
                await handleAcceptedSubmission(contestId, userId, problemId, contestTime);
            } else if (result.verdict !== 'Compilation Error') {
                // Track wrong submission attempts (compilation errors shouldn't penalize usually, but we can track it anyway)
                await incrementWrongAttempts(contestId, userId, problemId);
            }
        }

        // 5. Emit result to user via Socket.io
        emitSubmissionResult(userId, contestId, {
            submissionId,
            problemId,
            verdict: result.verdict,
            testResults: result.testResults.map((tr) => ({
                testCase: tr.testCase,
                passed: tr.passed,
                verdict: tr.verdict,
                // Only show sample test case details, hide hidden test case outputs
                ...(problem.testCases[tr.testCase - 1]?.isHidden
                    ? {}
                    : {
                        expectedOutput: tr.expectedOutput,
                        actualOutput: tr.actualOutput,
                    }),
            })),
            totalTests: result.totalTests,
            passedTests: result.passedTests,
            runtime: result.runtime,
            memory: result.memory,
            isSubmit,
        });

        return { verdict: result.verdict, passedTests: result.passedTests };

    } catch (err) {
        console.error(`❌ Error processing submission ${submissionId}:`, err.message);
        await handleFailedJob(job, err);
        throw err;
    }
};

const startWorker = async () => {
    try {
        await connectDB();
        console.log('✅ Worker connected to MongoDB');

        // Ensure redis client is initialized for pub/sub emitting
        getRedisClient();

        const connection = createRedisConnection();

        const worker = new Worker(
            QUEUE_NAME,
            async (job) => {
                return processSubmission(job);
            },
            {
                connection,
                concurrency: CONCURRENCY,
                limiter: {
                    max: 50,
                    duration: 1000,
                },
            }
        );

        worker.on('completed', (job, result) => {
            console.log(`✅ Job ${job.id} completed: ${result?.verdict}`);
        });

        worker.on('failed', (job, err) => {
            console.error(`❌ Job ${job?.id} failed:`, err.message);
        });

        worker.on('error', (err) => {
            console.error('❌ Worker error:', err.message);
        });

        console.log(`🚀 Dedicated Submission Worker running (concurrency: ${CONCURRENCY})`);
    } catch (err) {
        console.error('❌ Worker failed to start:', err);
        process.exit(1);
    }
};

startWorker();
