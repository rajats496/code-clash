/**
 * Load test configuration for 500 concurrent contest users.
 * Override via env: LOADTEST_SERVER_URL, LOADTEST_CONTEST_ID, etc.
 */
export const CONFIG = {
  /** Number of bot users (sockets) */
  BOT_COUNT: Math.min(1000, Math.max(1, parseInt(process.env.LOADTEST_BOT_COUNT, 10) || 500)),

  /** CodeClash API + Socket URL (e.g. https://cclash.duckdns.org or http://localhost:5000) */
  SERVER_URL: process.env.LOADTEST_SERVER_URL || 'http://localhost:5000',

  /** Contest ID (MongoDB ObjectId) — must be active and have bots registered */
  CONTEST_ID: process.env.LOADTEST_CONTEST_ID || '',

  /** First problem ID in the contest (from contest.problems[0].problem) */
  PROBLEM_ID: process.env.LOADTEST_PROBLEM_ID || '',

  /** Piston language ID (71 = Python 3, 63 = JavaScript) */
  LANGUAGE_ID: parseInt(process.env.LOADTEST_LANGUAGE_ID, 10) || 71,

  /** Code to submit (minimal valid snippet to avoid heavy execution) */
  CODE: process.env.LOADTEST_CODE || 'print("hello")',

  /** Path to bots JSON (output of seed-contest-bots.js) */
  BOTS_FILE: process.env.LOADTEST_BOTS_FILE || 'loadtest-bots.json',

  /** Stagger join-contest: delay in ms between each socket joining (mimics real users) */
  JOIN_STAGGER_MS: parseInt(process.env.LOADTEST_JOIN_STAGGER_MS, 10) || 80,

  /** After all joined, wait this many ms then fire simultaneous submit */
  SUBMIT_AFTER_MS: parseInt(process.env.LOADTEST_SUBMIT_AFTER_MS, 10) || 5000,

  /** Socket.io path if API is under a path */
  SOCKET_PATH: process.env.LOADTEST_SOCKET_PATH || '/socket.io',

  /** Transport: polling first often works better through proxies */
  TRANSPORTS: ['polling', 'websocket'],
};
