/**
 * Purge load-test bot users from MongoDB and Redis.
 * Run from server directory: node ../load-test/cleanup-bots.js
 *
 * Env: LOADTEST_CONTEST_ID (optional) — if set, only remove bots from this contest's
 *      participants and clean this contest's leaderboard entries for bots.
 *      If unset, removes bots from all contests they appear in.
 *
 * Bot identity: email matching /^loadtest-bot-\d+@loadtest\.local$/
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { connectDB } from '../server/src/config/db.js';
import { getRedisClient } from '../server/src/config/redis.js';
import { User } from '../server/src/models/User.model.js';
import { Contest } from '../server/src/models/Contest.model.js';
import { ContestSubmission } from '../server/src/models/ContestSubmission.model.js';

const EMAIL_REGEX = /^loadtest-bot-\d+@loadtest\.local$/;

async function run() {
  await connectDB();
  const redis = getRedisClient();

  const bots = await User.find({ email: EMAIL_REGEX }).select('_id email').lean();
  const botIds = bots.map((b) => b._id.toString());

  if (botIds.length === 0) {
    console.log('No load-test bots found (email pattern: loadtest-bot-*@loadtest.local).');
    await mongoose.disconnect();
    redis.quit();
    process.exit(0);
    return;
  }

  console.log(`Found ${botIds.length} load-test bot(s) to purge.`);

  const contestId = process.env.LOADTEST_CONTEST_ID || process.env.CONTEST_ID;

  if (contestId && mongoose.Types.ObjectId.isValid(contestId)) {
    const contest = await Contest.findById(contestId);
    if (contest) {
      const before = contest.participants.length;
      contest.participants = contest.participants.filter(
        (p) => !botIds.includes(p.user.toString())
      );
      await contest.save();
      console.log(`Removed bots from contest ${contestId}. Participants: ${before} → ${contest.participants.length}`);

      const lbKey = `leaderboard:${contestId}`;
      const lbDataKey = `lb-data:${contestId}`;
      for (const uid of botIds) {
        await redis.zrem(lbKey, uid);
        await redis.hdel(lbDataKey, uid);
      }
      console.log(`Cleaned Redis leaderboard/lb-data for contest ${contestId} for ${botIds.length} bots.`);

      for (const uid of botIds) {
        await redis.del(`contest:${contestId}:user:${uid}`);
        await redis.del(`ratelimit:contest-submit:${uid}`);
      }
      console.log(`Cleaned Redis contest:user and ratelimit keys for contest ${contestId}.`);
    }
  } else {
    const contests = await Contest.find({ 'participants.user': { $in: botIds } });
    for (const contest of contests) {
      const before = contest.participants.length;
      contest.participants = contest.participants.filter(
        (p) => !botIds.includes(p.user.toString())
      );
      await contest.save();
      console.log(`Contest ${contest._id}: participants ${before} → ${contest.participants.length}`);

      const cid = contest._id.toString();
      const lbKey = `leaderboard:${cid}`;
      const lbDataKey = `lb-data:${cid}`;
      for (const uid of botIds) {
        await redis.zrem(lbKey, uid);
        await redis.hdel(lbDataKey, uid);
        await redis.del(`contest:${cid}:user:${uid}`);
      }
    }
    for (const uid of botIds) {
      await redis.del(`ratelimit:contest-submit:${uid}`);
    }
    console.log(`Cleaned Redis for all contests and rate-limit keys.`);
  }

  const subResult = await ContestSubmission.deleteMany({ user: { $in: botIds } });
  console.log(`Deleted ${subResult.deletedCount} contest submission(s).`);

  const userResult = await User.deleteMany({ _id: { $in: botIds } });
  console.log(`Deleted ${userResult.deletedCount} user(s).`);

  await mongoose.disconnect();
  redis.quit();
  console.log('✅ Bot cleanup complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
