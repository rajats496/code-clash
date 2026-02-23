/**
 * Judge0 Code Execution Service
 *
 * Replaces mock-execution.service.js with real code execution via Judge0 API.
 * Keeps the same exported API surface so match.handler.js only needs
 * one import change.
 *
 *  Exported:
 *    runTestCases(sourceCode, languageId, testCases) → ExecutionResult
 *    executeCode(sourceCode, languageId, stdin)      → SingleResult
 */

import axios from 'axios';
import JUDGE0_CONFIG, { judge0IsConfigured } from '../config/judge0.js';

// ─────────────────────────────────────────────
//  Judge0 status IDs
// ─────────────────────────────────────────────
const JUDGE0_STATUS = {
  1:  'In Queue',
  2:  'Processing',
  3:  'Accepted',
  4:  'Wrong Answer',
  5:  'Time Limit Exceeded',
  6:  'Compilation Error',
  7:  'Runtime Error',   // SIGSEGV
  8:  'Runtime Error',   // SIGXFSZ (output limit)
  9:  'Runtime Error',   // SIGFPE  (float point)
  10: 'Runtime Error',   // SIGABRT
  11: 'Runtime Error',   // NZEC    (non-zero exit)
  12: 'Runtime Error',   // Other
  13: 'Internal Error',
  14: 'Exec Format Error',
};

// Poll settings
const POLL_INTERVAL_MS = 1200;
const MAX_POLLS        = 20;   // 24 s total max wait

// ─────────────────────────────────────────────
//  HTTP helpers
// ─────────────────────────────────────────────
const buildHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (JUDGE0_CONFIG.apiKey) {
    headers['X-RapidAPI-Key']  = JUDGE0_CONFIG.apiKey;
    headers['X-RapidAPI-Host'] = JUDGE0_CONFIG.apiHost;
  }
  return headers;
};

const judge0Client = axios.create({
  baseURL: JUDGE0_CONFIG.apiUrl,
  headers: buildHeaders(),
  timeout: JUDGE0_CONFIG.timeout,
});

// ─────────────────────────────────────────────
//  Core Judge0 primitives
// ─────────────────────────────────────────────

/**
 * Submit source code + stdin to Judge0.
 * Returns the submission token.
 */
const submitToJudge0 = async (sourceCode, languageId, stdin = '') => {
  const response = await judge0Client.post(
    '/submissions?base64_encoded=false&wait=false',
    {
      source_code: sourceCode,
      language_id: languageId,
      stdin:        stdin || '',
    }
  );
  const token = response.data?.token;
  if (!token) throw new Error('Judge0 did not return a submission token');
  return token;
};

/**
 * Poll Judge0 until the submission is finished.
 * Status IDs 1 (In Queue) and 2 (Processing) mean still running.
 */
const pollSubmission = async (token) => {
  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const response = await judge0Client.get(
      `/submissions/${token}?base64_encoded=false`
    );
    const data = response.data;

    if (data.status.id > 2) {
      return data; // finished (accepted / error / etc.)
    }
  }
  throw new Error(
    `Judge0 timed out after ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s`
  );
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/** Trim and normalize line endings for consistent comparison */
const normalizeOutput = (s) => (s || '').trim().replace(/\r\n/g, '\n');

/** Map Judge0 status ID to a human-friendly verdict string */
const toVerdict = (statusId) => JUDGE0_STATUS[statusId] || 'Runtime Error';

/** Format Judge0 time (e.g. "0.042") → "42 ms" */
const formatTime = (t) => {
  if (!t) return null;
  const ms = Math.round(parseFloat(t) * 1000);
  return `${ms} ms`;
};

/** Format Judge0 memory (KB) → "1.23 MB" */
const formatMemory = (kb) => {
  if (!kb) return null;
  const mb = (kb / 1024).toFixed(2);
  return `${mb} MB`;
};

// ─────────────────────────────────────────────
//  Public: executeCode (single stdin/stdout)
// ─────────────────────────────────────────────
export const executeCode = async (sourceCode, languageId, stdin = '') => {
  if (!judge0IsConfigured) {
    throw new Error(
      'Judge0 is not configured. Set JUDGE0_API_KEY or JUDGE0_API_URL in .env'
    );
  }

  const token  = await submitToJudge0(sourceCode, languageId, stdin);
  const result = await pollSubmission(token);
  const statusId = result.status.id;

  return {
    verdict:         toVerdict(statusId),
    stdout:          result.stdout          || '',
    stderr:          result.stderr          || '',
    compile_output:  result.compile_output  || '',
    exitCode:        statusId === 3 ? 0 : 1,
    time:            result.time,
    memory:          result.memory,
  };
};

// ─────────────────────────────────────────────
//  Public: runTestCases — main arena path
// ─────────────────────────────────────────────

/**
 * Run all provided test cases against the submitted code via Judge0.
 *
 * Returns the same shape as the old mock service so match.handler.js
 * requires only a single import change:
 *
 *   { verdict, allTestsPassed, testResults, totalTests, passedTests,
 *     runtime, memory }
 */
export const runTestCases = async (sourceCode, languageId, testCases) => {
  if (!judge0IsConfigured) {
    console.error('❌ Judge0 not configured — returning execution error');
    const errorResults = testCases.map((tc, i) => ({
      testCase: i + 1,
      passed:   false,
      verdict:  'Configuration Error',
      expectedOutput: tc.expectedOutput,
      actualOutput:   '',
      stderr: 'Judge0 API is not configured. Add JUDGE0_API_KEY to .env',
    }));
    return {
      verdict:        'Configuration Error',
      allTestsPassed: false,
      testResults:    errorResults,
      totalTests:     testCases.length,
      passedTests:    0,
      runtime:        null,
      memory:         null,
    };
  }

  console.log(`⚡ Judge0: running ${testCases.length} test case(s), lang=${languageId}`);

  const testResults  = [];
  let passedTests    = 0;
  let firstFailure   = null;
  let compilationErr = null;

  // Aggregate performance metrics (reported for accepted submissions)
  let totalTimeMs  = 0;
  let maxMemoryKB  = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];

    try {
      const token  = await submitToJudge0(sourceCode, languageId, tc.input);
      const result = await pollSubmission(token);
      const statusId = result.status.id;

      // ── Compilation Error — all remaining tests will also fail ──
      if (statusId === 6) {
        const errMsg =
          normalizeOutput(result.compile_output) ||
          normalizeOutput(result.stderr)         ||
          'Compilation failed';

        compilationErr = errMsg;

        // Mark this and all remaining test cases as failed
        for (let j = i; j < testCases.length; j++) {
          testResults.push({
            testCase:       j + 1,
            passed:         false,
            verdict:        'Compilation Error',
            expectedOutput: testCases[j].expectedOutput,
            actualOutput:   '',
            stderr:         j === i ? errMsg : '',
          });
        }
        break; // no point running more
      }

      const actualOutput   = normalizeOutput(result.stdout);
      const expectedOutput = normalizeOutput(tc.expectedOutput);
      const isAccepted     = statusId === 3;
      const outputMatches  = actualOutput === expectedOutput;
      const passed         = isAccepted && outputMatches;

      const verdict = passed
        ? 'Accepted'
        : isAccepted && !outputMatches
          ? 'Wrong Answer'
          : toVerdict(statusId);

      // Track performance
      if (result.time)   totalTimeMs  += Math.round(parseFloat(result.time) * 1000);
      if (result.memory) maxMemoryKB   = Math.max(maxMemoryKB, result.memory);

      testResults.push({
        testCase:       i + 1,
        passed,
        verdict,
        expectedOutput: tc.expectedOutput,
        actualOutput:   result.stdout || '',
        stderr:         result.stderr || '',
        time:           formatTime(result.time),
        memory:         formatMemory(result.memory),
      });

      if (passed) {
        passedTests++;
      } else if (!firstFailure) {
        firstFailure = verdict;
      }

    } catch (err) {
      console.error(`❌ Judge0 error on test case ${i + 1}:`, err.message);

      const errVerdict = 'Runtime Error';
      testResults.push({
        testCase:       i + 1,
        passed:         false,
        verdict:        errVerdict,
        expectedOutput: tc.expectedOutput,
        actualOutput:   '',
        stderr:         err.message,
      });

      if (!firstFailure) firstFailure = errVerdict;
    }
  }

  const allTestsPassed = passedTests === testCases.length;

  const overallVerdict = compilationErr
    ? 'Compilation Error'
    : allTestsPassed
      ? 'Accepted'
      : firstFailure || 'Wrong Answer';

  // Summarise performance
  const avgTimeMs = testResults.length > 0
    ? Math.round(totalTimeMs / testResults.length)
    : null;

  const runtime = avgTimeMs != null ? `${avgTimeMs} ms`   : null;
  const memory  = maxMemoryKB > 0  ? formatMemory(maxMemoryKB) : null;

  console.log(
    `✅ Judge0 done: ${overallVerdict} — ${passedTests}/${testCases.length} passed` +
    (runtime ? ` | ${runtime}` : '') +
    (memory  ? ` | ${memory}`  : '')
  );

  return {
    verdict:        overallVerdict,
    allTestsPassed,
    testResults,
    totalTests:     testCases.length,
    passedTests,
    runtime,
    memory,
    compilationError: compilationErr,
  };
};
