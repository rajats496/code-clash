import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,   // Allow null — email-only users don't have googleId
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    password: {
      type: String,   // bcrypt hash — null for Google-only users
      select: false,  // Don't include in queries by default
    },
    picture: {
      type: String,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    rating: {
      type: Number,
      default: 1200, // ELO-style rating (future enhancement)
    },
    matchesPlayed: {
      type: Number,
      default: 0,
    },
    matchesWon: {
      type: Number,
      default: 0,
    },
    friends: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    friendRequests: [{
      from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true } // createdAt, updatedAt
);

// Hash password before saving (only if modified)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare plain password to hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);