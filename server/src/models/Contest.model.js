/**
 * Contest Model
 * 
 * Represents a LeetCode-style timed contest with multiple problems.
 * Supports up to 1000 participants, ICPC-style penalty scoring.
 */

import mongoose from 'mongoose';

const contestProblemSchema = new mongoose.Schema({
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true,
  },
  order: {
    type: Number,       // Display order (1, 2, 3, 4)
    required: true,
  },
  points: {
    type: Number,       // Max points for this problem
    default: 100,
  },
}, { _id: false });

const contestParticipantSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  // Submission tracking per problem
  problemStatus: [{
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
    },
    solved: {
      type: Boolean,
      default: false,
    },
    solveTime: {
      type: Number,     // Seconds from contest start when accepted
      default: null,
    },
    attempts: {
      type: Number,     // Number of wrong submissions before accepted
      default: 0,
    },
    penaltyTime: {
      type: Number,     // Total penalty in seconds (solveTime + attempts * 20min)
      default: 0,
    },
  }],
  // Aggregate scores
  totalSolved: {
    type: Number,
    default: 0,
  },
  totalPenalty: {
    type: Number,       // Total penalty time in seconds (ICPC style)
    default: 0,
  },
  totalPoints: {
    type: Number,       // Total points scored (LeetCode style)
    default: 0,
  },
  rank: {
    type: Number,
    default: null,
  },
}, { _id: false });

const contestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    // Contest code (for joining via invite)
    code: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      index: true,
    },
    // Problems in the contest
    problems: [contestProblemSchema],

    // Timing
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,     // Duration in minutes
      required: true,
      min: 10,
      max: 300,         // Max 5 hours
    },

    // Participants
    participants: [contestParticipantSchema],

    // Capacity
    maxParticipants: {
      type: Number,
      default: 1000,
      max: 10000,
    },

    // Contest status
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'ended', 'cancelled'],
      default: 'draft',
    },

    // Scoring type
    scoringType: {
      type: String,
      enum: ['icpc', 'leetcode'],
      default: 'icpc',
      // icpc: rank by solved count, then penalty time
      // leetcode: rank by points, then finish time
    },

    // Penalty per wrong submission (in minutes, for ICPC scoring)
    wrongSubmissionPenalty: {
      type: Number,
      default: 20,      // 20 minutes per wrong answer (standard ICPC)
    },

    // Creator
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Visibility
    isPublic: {
      type: Boolean,
      default: true,
    },

    // Rating changes applied?
    ratingProcessed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
contestSchema.index({ status: 1, startTime: 1 });
contestSchema.index({ startTime: -1 });
contestSchema.index({ 'participants.user': 1 });
contestSchema.index({ code: 1 });

// Virtual: is contest currently active
contestSchema.virtual('isActive').get(function () {
  const now = new Date();
  return this.status === 'active' && now >= this.startTime && now <= this.endTime;
});

// Virtual: time remaining in seconds
contestSchema.virtual('timeRemaining').get(function () {
  if (this.status !== 'active') return 0;
  const remaining = Math.max(0, (this.endTime - new Date()) / 1000);
  return Math.floor(remaining);
});

// Method: Check if a user is registered
contestSchema.methods.isUserRegistered = function (userId) {
  return this.participants.some(
    (p) => p.user.toString() === userId.toString()
  );
};

// Method: Get participant's data
contestSchema.methods.getParticipant = function (userId) {
  return this.participants.find(
    (p) => p.user.toString() === userId.toString()
  );
};

// Static: Get upcoming/active contests
contestSchema.statics.getActiveAndUpcoming = function () {
  const now = new Date();
  return this.find({
    status: { $in: ['scheduled', 'active'] },
    endTime: { $gte: now },
  })
    .populate('problems.problem', 'title difficulty')
    .populate('createdBy', 'name picture')
    .sort({ startTime: 1 });
};

contestSchema.set('toJSON', { virtuals: true });

export const Contest = mongoose.model('Contest', contestSchema);
