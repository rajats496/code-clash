/**
 * Seed script: create 500 load-test bot users, register them for a contest, output JWTs.
 * Run from server directory: node load-test/seed-contest-bots.js
 * Or from project root: node -r dotenv/config load-test/seed-contest-bots.js (with path to .env)
 *
 * Requires: CONTEST_ID and optionally BOT_COUNT (default 500).
 * Output: loadtest-bots.json in load-test/ (or cwd).
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from server or project root (run from project root: node load-test/seed-contest-bots.js)
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { connectDB } from '../server/src/config/db.js';
import { User } from '../server/src/models/User.model.js';
import { Contest } from '../server/src/models/Contest.model.js';
import { generateJWT } from '../server/src/services/auth.service.js';
import fs from 'fs';

const BOT_COUNT = Math.min(1000, Math.max(1, parseInt(process.env.LOADTEST_BOT_COUNT, 10) || 500));
const CONTEST_ID = process.env.LOADTEST_CONTEST_ID || process.env.CONTEST_ID;

const EMAIL_PREFIX = 'loadtest-bot-';
const EMAIL_DOMAIN = '@loadtest.local';
const NAME_PREFIX = 'LoadTestBot_';

async function run() {
  if (!CONTEST_ID || !mongoose.Types.ObjectId.isValid(CONTEST_ID)) {
    console.error('Set LOADTEST_CONTEST_ID (or CONTEST_ID) to a valid contest ObjectId.');
    process.exit(1);
  }

  await connectDB();

  const contest = await Contest.findById(CONTEST_ID);
  if (!contest) {
    console.error('Contest not found:', CONTEST_ID);
    process.exit(1);
  }
  if (contest.status !== 'scheduled' && contest.status !== 'draft' && contest.status !== 'active') {
    console.error('Contest must be in draft, scheduled, or active state. Current:', contest.status);
    process.exit(1);
  }
  if ((contest.participants?.length || 0) + BOT_COUNT > (contest.maxParticipants || 1000)) {
    console.error('Contest would exceed maxParticipants. Increase maxParticipants or reduce BOT_COUNT.');
    process.exit(1);
  }

  const problemStatus = contest.problems.map((p) => ({
    problem: p.problem,
    solved: false,
    solveTime: null,
    attempts: 0,
    penaltyTime: 0,
  }));

  const bots = [];
  const existingEmails = new Set((await User.find({ email: new RegExp(`^${EMAIL_PREFIX}.*${EMAIL_DOMAIN.replace('.', '\\.')}$`) }).select('email').lean()).map((u) => u.email));

  for (let i = 1; i <= BOT_COUNT; i++) {
    const email = `${EMAIL_PREFIX}${i}${EMAIL_DOMAIN}`;
    if (existingEmails.has(email)) {
      const u = await User.findOne({ email }).lean();
      if (u) {
        const token = generateJWT(u);
        bots.push({ userId: u._id.toString(), email, name: u.name, token });
      }
      continue;
    }

    const user = await User.create({
      email,
      name: `${NAME_PREFIX}${i}`,
      role: 'user',
      rating: 1200,
    });
    const token = generateJWT(user);
    bots.push({ userId: user._id.toString(), email, name: user.name, token });

    const result = await Contest.findOneAndUpdate(
      {
        _id: CONTEST_ID,
        status: { $nin: ['ended', 'cancelled'] },
        'participants.user': { $ne: user._id },
        [`participants.${(contest.maxParticipants || 1000) - 1}`]: { $exists: false },
      },
      {
        $push: {
          participants: {
            user: user._id,
            joinedAt: new Date(),
            problemStatus,
            totalSolved: 0,
            totalPenalty: 0,
            totalPoints: 0,
          },
        },
      },
      { new: true }
    );

    if (!result) {
      console.error(`Failed to register bot ${i} for contest. Contest may be full or already registered.`);
    }

    if (i % 50 === 0) console.log(`Created & registered ${i}/${BOT_COUNT} bots...`);
  }

  const outPath = path.join(__dirname, 'loadtest-bots.json');
  fs.writeFileSync(outPath, JSON.stringify({ contestId: CONTEST_ID, problemId: contest.problems[0]?.problem?.toString(), bots }, null, 0));
  console.log(`✅ Wrote ${bots.length} bots to ${outPath}`);
  console.log(`   Contest: ${CONTEST_ID}, first problemId: ${contest.problems[0]?.problem?.toString()}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
