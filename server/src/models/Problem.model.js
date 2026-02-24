import mongoose from 'mongoose';

const testCaseSchema = new mongoose.Schema({
  input: {
    type: String,
    required: true,
  },
  expectedOutput: {
    type: String,
    required: true,
  },
  isHidden: {
    type: Boolean,
    default: false, // false = sample test, true = hidden test
  },
});

const problemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    testCases: [testCaseSchema],
    languagesAllowed: {
      type: [Number], // Judge0 language IDs (e.g., [71, 63] for Python, JS)
      default: [71, 63, 62, 54, 50, 998, 999], // Python, JS, Java, C++, C, Fortran, D
    },
    timeLimit: {
      type: Number,
      default: 2, // seconds per test case
    },
    memoryLimit: {
      type: Number,
      default: 256, // MB
    },
  },
  { timestamps: true }
);

export const Problem = mongoose.model('Problem', problemSchema);