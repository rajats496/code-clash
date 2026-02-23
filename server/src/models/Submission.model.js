import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
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
      type: Number, // Judge0 language ID
      required: true,
    },
    verdict: {
      type: String,
      enum: [
        'Pending', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded',
        'Runtime Error', 'Compilation Error', 'Memory Limit Exceeded',
        'Configuration Error', 'Internal Error', 'Exec Format Error',
      ],
      default: 'Pending',
    },
    judge0Token: String, // Judge0 submission token for tracking
    executionTime: Number, // milliseconds
    memory: Number, // KB
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true, // For ordering submissions
    },
  },
  { timestamps: true }
);

// Compound index for match + user submissions
submissionSchema.index({ match: 1, user: 1, submittedAt: -1 });

export const Submission = mongoose.model('Submission', submissionSchema);