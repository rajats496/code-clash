/**
 * Submission Queue Service (BullMQ)
 * 
 * Manages the submission processing pipeline for contest mode.
 * - Adds submissions to a BullMQ queue
 * - Workers pick up jobs and execute code via Judge0
 * - Results are emitted back via Socket.io
 * 
 * Designed for 1000 concurrent users:
 * - Rate limiting built in (1 submission per 10s per user)
 * - Priority queue (earlier submissions processed first)
 * - Retry logic for transient failures
 * - Job timeout to prevent stuck submissions
 */

import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { ContestSubmission } from '../models/ContestSubmission.model.js';

const QUEUE_NAME = 'contest-submissions';
const CONCURRENCY = 10; // Process 10 submissions simultaneously

let submissionQueue = null;
let submissionWorker = null;
let queueEvents = null;

// ─────────────────────────────────────────────
//  Initialize Queue
// ─────────────────────────────────────────────
export const initSubmissionQueue = () => {
  const connection = createRedisConnection();

  submissionQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },  // Keep last 1000 completed jobs
      removeOnFail: { count: 500 },       // Keep last 500 failed jobs
      attempts: 2,                         // Retry once on failure
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      timeout: 60000,                     // 60s timeout per job
    },
  });

  console.log('✅ Submission queue initialized');
  return submissionQueue;
};

// Worker initialization moved to separate worker.js
// ─────────────────────────────────────────────
//  Initialize Queue Events (for monitoring)
// ─────────────────────────────────────────────
export const initQueueEvents = () => {
  const connection = createRedisConnection();

  queueEvents = new QueueEvents(QUEUE_NAME, { connection });

  queueEvents.on('waiting', ({ jobId }) => {
    console.log(`📋 Job ${jobId} waiting in queue`);
  });

  queueEvents.on('active', ({ jobId }) => {
    console.log(`⚙️ Job ${jobId} processing`);
  });

  return queueEvents;
};

// ─────────────────────────────────────────────
//  Add Submission to Queue
// ─────────────────────────────────────────────
export const addSubmission = async ({
  submissionId,
  contestId,
  userId,
  problemId,
  sourceCode,
  languageId,
  contestTime,
  isSubmit,
}) => {
  if (!submissionQueue) {
    throw new Error('Submission queue not initialized');
  }

  const job = await submissionQueue.add(
    'judge-submission',
    {
      submissionId,
      contestId,
      userId,
      problemId,
      sourceCode,
      languageId,
      contestTime,
      isSubmit,
    },
    {
      // Priority: lower number = higher priority
      // Earlier submissions get processed first (BullMQ max priority = 2097152)
      priority: Math.min(contestTime || 1, 2097152),
      // Job ID for deduplication
      jobId: `sub-${submissionId}-${Date.now()}`,
    }
  );

  // Update submission status to processing (only for real submits)
  if (isSubmit && submissionId !== 'temp_run') {
    await ContestSubmission.findByIdAndUpdate(submissionId, {
      status: 'processing',
      jobId: job.id,
    });
  }

  return job;
};

// Logic moved to worker.js

// ─────────────────────────────────────────────
//  Queue stats (for monitoring)
// ─────────────────────────────────────────────
export const getQueueStats = async () => {
  if (!submissionQueue) return null;

  const [waiting, active, completed, failed] = await Promise.all([
    submissionQueue.getWaitingCount(),
    submissionQueue.getActiveCount(),
    submissionQueue.getCompletedCount(),
    submissionQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
};

// ─────────────────────────────────────────────
//  Graceful shutdown
// ─────────────────────────────────────────────
export const closeQueue = async () => {
  const promises = [];

  if (submissionWorker) {
    promises.push(submissionWorker.close());
    submissionWorker = null;
  }
  if (queueEvents) {
    promises.push(queueEvents.close());
    queueEvents = null;
  }
  if (submissionQueue) {
    promises.push(submissionQueue.close());
    submissionQueue = null;
  }

  await Promise.all(promises);
  console.log('🔌 Submission queue closed');
};

export default {
  initSubmissionQueue,
  initQueueEvents,
  addSubmission,
  getQueueStats,
  closeQueue,
};
