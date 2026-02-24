/**
 * Contest Scheduler Service
 *
 * Persistent polling-based scheduler that:
 * 1. Auto-starts contests when startTime arrives (scheduled → active)
 * 2. Auto-ends contests when endTime passes (active → ended)
 *
 * Survives server restarts — polls MongoDB every 15 seconds.
 * No in-memory timers that get lost on crash/deploy.
 */

import { Contest } from '../models/Contest.model.js';
import { User } from '../models/User.model.js';
import { initLeaderboard } from './leaderboard.service.js';
import { getIO } from '../socket/index.js';

const POLL_INTERVAL_MS = 15_000; // Check every 15 seconds
let pollTimer = null;

// ─────────────────────────────────────────────
//  Start the scheduler
// ─────────────────────────────────────────────
export const startContestScheduler = () => {
  console.log('⏱️  Contest scheduler started (polling every 15s)');
  // Run immediately, then every POLL_INTERVAL_MS
  pollContests();
  pollTimer = setInterval(pollContests, POLL_INTERVAL_MS);
};

// ─────────────────────────────────────────────
//  Stop the scheduler (graceful shutdown)
// ─────────────────────────────────────────────
export const stopContestScheduler = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('⏱️  Contest scheduler stopped');
  }
};

// ─────────────────────────────────────────────
//  Poll for contests that need starting or ending
// ─────────────────────────────────────────────
const pollContests = async () => {
  try {
    const now = new Date();
    await Promise.all([
      autoStartContests(now),
      autoEndContests(now),
    ]);
  } catch (err) {
    console.error('❌ Contest scheduler poll error:', err.message);
  }
};

// ─────────────────────────────────────────────
//  Auto-start: scheduled → active
// ─────────────────────────────────────────────
const autoStartContests = async (now) => {
  // Find contests that should have started but are still "scheduled"
  const contests = await Contest.find({
    status: 'scheduled',
    startTime: { $lte: now },
  });

  for (const contest of contests) {
    try {
      // Use findOneAndUpdate to prevent race conditions between multiple polls
      const updated = await Contest.findOneAndUpdate(
        { _id: contest._id, status: 'scheduled' },
        { $set: { status: 'active' } },
        { new: true }
      );

      if (!updated) continue; // Another process already started it

      // Initialize Redis leaderboard
      const participantIds = updated.participants.map((p) => p.user.toString());
      await initLeaderboard(updated._id.toString(), participantIds);

      // Notify all participants
      try {
        const io = getIO();
        io.to(`contest-${updated._id}`).emit('contest-started', {
          contestId: updated._id,
          startTime: updated.startTime,
          endTime: updated.endTime,
          duration: updated.duration,
        });
      } catch { /* socket not ready */ }

      console.log(`🏆 Auto-started contest: ${updated.title} (${participantIds.length} participants)`);
    } catch (err) {
      console.error(`❌ Failed to auto-start contest ${contest._id}:`, err.message);
    }
  }
};

// ─────────────────────────────────────────────
//  Auto-end: active → ended (when endTime passes)
// ─────────────────────────────────────────────
const autoEndContests = async (now) => {
  // Find active contests whose endTime has passed
  const contests = await Contest.find({
    status: 'active',
    endTime: { $lte: now },
  });

  for (const contest of contests) {
    try {
      // Atomic status check to prevent double-finalization
      const locked = await Contest.findOneAndUpdate(
        { _id: contest._id, status: 'active' },
        { $set: { status: 'ending' } }, // Transitional state
        { new: true }
      );

      if (!locked) continue; // Already being ended

      await finalizeContest(locked);

      console.log(`⏰ Auto-ended contest: ${locked.title}`);
    } catch (err) {
      console.error(`❌ Failed to auto-end contest ${contest._id}:`, err.message);
      // Reset status so it can be retried
      await Contest.findByIdAndUpdate(contest._id, { $set: { status: 'active' } });
    }
  }
};

// ─────────────────────────────────────────────
//  Finalize contest (shared logic)
// ─────────────────────────────────────────────
export const finalizeContest = async (contest) => {
  // Re-fetch to get latest participant data (may have been updated by workers)
  const fresh = await Contest.findById(contest._id);
  if (!fresh) return;

  fresh.status = 'ended';

  // Sort participants and assign final ranks
  const sorted = fresh.participants.sort((a, b) => {
    if (fresh.scoringType === 'leetcode') {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return a.totalPenalty - b.totalPenalty;
    }
    // ICPC
    if (b.totalSolved !== a.totalSolved) return b.totalSolved - a.totalSolved;
    return a.totalPenalty - b.totalPenalty;
  });

  sorted.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  await fresh.save();

  // Update user ratings
  if (!fresh.ratingProcessed) {
    await updateContestRatings(fresh);
    fresh.ratingProcessed = true;
    await fresh.save();
  }

  // Notify via socket
  try {
    const io = getIO();
    io.to(`contest-${fresh._id}`).emit('contest-ended', {
      contestId: fresh._id,
      message: 'Contest has ended! Check the final standings.',
    });
  } catch { /* socket not ready */ }
};

// ─────────────────────────────────────────────
//  Rating updates
// ─────────────────────────────────────────────
const updateContestRatings = async (contest) => {
  const totalParticipants = contest.participants.length;
  if (totalParticipants === 0) return;

  const bulkOps = contest.participants.map((p) => {
    const percentile = p.rank / totalParticipants;
    let ratingChange = 0;

    if (percentile <= 0.1) ratingChange = 50;
    else if (percentile <= 0.3) ratingChange = 25;
    else if (percentile <= 0.5) ratingChange = 10;
    else if (percentile <= 0.7) ratingChange = 0;
    else if (percentile <= 0.9) ratingChange = -10;
    else ratingChange = -20;

    return {
      updateOne: {
        filter: { _id: p.user },
        update: {
          $inc: {
            rating: ratingChange,
            matchesPlayed: 1,
            ...(p.rank === 1 ? { matchesWon: 1 } : {}),
          },
        },
      },
    };
  });

  await User.bulkWrite(bulkOps);
  console.log(`📊 Ratings updated for ${totalParticipants} participants`);
};
