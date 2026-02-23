import mongoose from 'mongoose';

const roundResultSchema = new mongoose.Schema({
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
  },
  solved: { type: Boolean, default: false },
  solveTime: Number,       // seconds taken to solve this round
  wrongSubmissions: { type: Number, default: 0 },
}, { _id: false });

const matchSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Legacy single-problem field (kept for backward compat with old matches)
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
    },
    // New: array of problems for multi-round matches
    problems: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
    }],
    totalRounds: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },
    currentRound: {
      type: Number,
      default: 0,
    },
    players: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        socketId: String,
        firstAcceptedAt: Date,
        wrongSubmissions: {
          type: Number,
          default: 0,
        },
        effectiveTime: Number,
        solvedCount: {
          type: Number,
          default: 0,
        },
        roundResults: [roundResultSchema],
      },
    ],
    status: {
      type: String,
      enum: ['waiting', 'in-progress', 'completed', 'abandoned'],
      default: 'waiting',
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    startedAt: Date,
    completedAt: Date,
    duration: Number,
    isPrivate: { type: Boolean, default: false },
    chatMessages: [
      {
        userId: String,
        senderName: String,
        senderPicture: String,
        message: String,
        sentAt: { type: String, default: () => new Date().toISOString() },
      },
    ],
  },
  { timestamps: true }
);

matchSchema.index({ status: 1, startedAt: -1 });

export const Match = mongoose.model('Match', matchSchema);