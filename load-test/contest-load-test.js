/**
 * Contest load test: 500 authenticated sockets, staggered join-contest, simultaneous submit.
 * Run: node load-test/contest-load-test.js
 * Env: LOADTEST_SERVER_URL, LOADTEST_BOTS_FILE (default load-test/loadtest-bots.json).
 * Config in config.js (CONTEST_ID, PROBLEM_ID, etc. can come from bots file).
 */

import { io } from 'socket.io-client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { CONFIG } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadBots() {
  const p = path.resolve(__dirname, CONFIG.BOTS_FILE);
  const raw = readFileSync(p, 'utf8');
  const data = JSON.parse(raw);
  if (!data.bots || !Array.isArray(data.bots) || data.bots.length === 0) {
    throw new Error('loadtest-bots.json must contain { bots: [{ userId, token }, ...] }');
  }
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const metrics = {
  connected: 0,
  joined: 0,
  submissionQueued: 0,
  submissionResult: 0,
  errors: 0,
  joinLatencyMs: [],
  submitLatencyMs: [],
};

function log(line) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${line}`);
}

export async function runLoadTest() {
  const { bots, contestId, problemId } = loadBots();
  const contestIdFinal = CONFIG.CONTEST_ID || contestId;
  const problemIdFinal = CONFIG.PROBLEM_ID || problemId;

  if (!contestIdFinal || !problemIdFinal) {
    throw new Error('CONTEST_ID and PROBLEM_ID required (set in config or in loadtest-bots.json)');
  }

  const count = Math.min(CONFIG.BOT_COUNT, bots.length);
  const botsToUse = bots.slice(0, count);

  log(`Starting load test: ${count} bots, SERVER_URL=${CONFIG.SERVER_URL}`);
  log(`Contest: ${contestIdFinal}, Problem: ${problemIdFinal}, Submit after: ${CONFIG.SUBMIT_AFTER_MS}ms`);

  const sockets = [];
  const joinTimes = [];
  const submitTimes = [];

  for (let i = 0; i < botsToUse.length; i++) {
    const { token } = botsToUse[i];
    const socket = io(CONFIG.SERVER_URL, {
      auth: { token },
      path: CONFIG.SOCKET_PATH,
      transports: CONFIG.TRANSPORTS,
      reconnection: false,
    });

    socket.on('connect', () => {
      metrics.connected++;
    });

    socket.on('contest-joined', () => {
      metrics.joined++;
      joinTimes.push(Date.now());
    });

    socket.on('contest-submission-queued', () => {
      metrics.submissionQueued++;
      submitTimes.push(Date.now());
    });

    socket.on('contest-submission-result', () => {
      metrics.submissionResult++;
    });

    socket.on('contest-error', (d) => {
      metrics.errors++;
      if (metrics.errors <= 3) log(`contest-error: ${JSON.stringify(d?.message || d)}`);
    });

    socket.on('connect_error', (err) => {
      metrics.errors++;
      if (metrics.errors <= 3) log(`connect_error: ${err.message}`);
    });

    sockets.push(socket);
    await sleep(CONFIG.JOIN_STAGGER_MS);
  }

  log(`All ${count} sockets created (staggered). Waiting for connections...`);
  await sleep(2000);

  const connectDeadline = Date.now() + 15000;
  while (metrics.connected < count && Date.now() < connectDeadline) {
    await sleep(200);
  }
  log(`Connected: ${metrics.connected}/${count}`);

  const joinStart = Date.now();
  for (let i = 0; i < sockets.length; i++) {
    if (sockets[i].connected) {
      sockets[i].emit('join-contest', { contestId: contestIdFinal });
    }
    await sleep(CONFIG.JOIN_STAGGER_MS);
  }

  const joinDeadline = Date.now() + 10000;
  while (metrics.joined < metrics.connected && Date.now() < joinDeadline) {
    await sleep(100);
  }
  const joinEnd = Date.now();
  log(`Joined: ${metrics.joined}/${metrics.connected} (took ${joinEnd - joinStart}ms)`);

  await sleep(CONFIG.SUBMIT_AFTER_MS);

  const submitStart = Date.now();
  const code = CONFIG.CODE;
  const languageId = CONFIG.LANGUAGE_ID;

  for (const s of sockets) {
    if (s.connected) {
      s.emit('contest-submit', {
        contestId: contestIdFinal,
        problemId: problemIdFinal,
        code,
        language: languageId,
      });
    }
  }
  log(`Fired ${sockets.filter((s) => s.connected).length} simultaneous submissions at T+${submitStart - joinStart}ms`);

  const resultDeadline = Date.now() + 120000;
  while (
    (metrics.submissionQueued + metrics.submissionResult + metrics.errors) < metrics.connected &&
    Date.now() < resultDeadline
  ) {
    await sleep(500);
  }
  const submitEnd = Date.now();
  log(`Submission phase ended. Queued: ${metrics.submissionQueued}, Results: ${metrics.submissionResult}, Errors: ${metrics.errors}`);

  await sleep(2000);
  sockets.forEach((s) => s.disconnect());

  const report = {
    bots: count,
    connected: metrics.connected,
    joined: metrics.joined,
    submissionQueued: metrics.submissionQueued,
    submissionResult: metrics.submissionResult,
    errors: metrics.errors,
    joinDurationMs: joinEnd - joinStart,
    submitToResultMs: submitEnd - submitStart,
  };
  log(`Report: ${JSON.stringify(report, null, 2)}`);
  return report;
}

runLoadTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
