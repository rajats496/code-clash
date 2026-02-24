/**
 * ContestSubmission Model
 * 
 * Tracks every code submission in a contest.
 * Linked to contest, user, and problem.
 */

import mongoose from 'mongoose';

const contestSubmissionSchema = new mongoose.Schema(
  {
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contest',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    language: {
      type: Number,     // Judge0 language ID
      required: true,
    },
    // Execution status
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
    },
    // Final verdict after judging
    verdict: {
      type: String,
      enum: [
        'Pending', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded',
        'Runtime Error', 'Compilation Error', 'Memory Limit Exceeded',
        'Configuration Error', 'Internal Error',
      ],
      default: 'Pending',
    },
    // Test case results
    testResults: [{
      testCase: Number,
      passed: Boolean,
      verdict: String,
      expectedOutput: String,
      actualOutput: String,
      time: String,
      memory: String,
    }],
    totalTests: {
      type: Number,
      default: 0,
    },
    passedTests: {
      type: Number,
      default: 0,
    },
    // Performance metrics
    executionTime: String,    // e.g. "42 ms"
    memoryUsed: String,       // e.g. "1.23 MB"

    // Timing
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    judgedAt: {
      type: Date,
    },
    // Time from contest start in seconds
    contestTime: {
      type: Number,
    },
    // Queue job ID (for BullMQ tracking)
    jobId: {
      type: String,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
contestSubmissionSchema.index({ contest: 1, user: 1, problem: 1, submittedAt: -1 });
contestSubmissionSchema.index({ contest: 1, problem: 1, verdict: 1 });
contestSubmissionSchema.index({ user: 1, contest: 1, submittedAt: -1 });
contestSubmissionSchema.index({ status: 1 });  // For queue processing

export const ContestSubmission = mongoose.model('ContestSubmission', contestSubmissionSchema);
