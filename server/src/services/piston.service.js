/**
 * Piston Code Execution Service
 *
 * Free, no-API-key-needed execution via https://emkc.org/api/v2/piston
 * Supports Python, JavaScript, Java, C++.
 *
 * Drop-in replacement for judge0.service.js — exports identical API surface:
 *   runTestCases(sourceCode, languageId, testCases) → ExecutionResult
 *   executeCode(sourceCode, languageId, stdin)      → SingleResult
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const PISTON_BASE = process.env.PISTON_URL || 'http://localhost:2000';
const PISTON_URL = `${PISTON_BASE}/api/v2/execute`;
const TIMEOUT_MS = 15000;

// ─────────────────────────────────────────────
//  Language mapping  (Judge0 ID → Piston lang)
// ─────────────────────────────────────────────
const LANG_MAP = {
  63: { language: 'javascript', version: '*' },
  71: { language: 'python', version: '*' },
  62: { language: 'java', version: '*' },
  54: { language: 'c++', version: '*' },
  50: { language: 'c', version: '*' },
  51: { language: 'csharp', version: '*' },
};

const getLang = (languageId) =>
  LANG_MAP[languageId] || { language: 'python', version: '*' };

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const normalizeOutput = (s) =>
  (s || '')
    .replace(/\r\n/g, '\n')    // Windows line endings
    .replace(/\r/g, '\n')       // Old Mac line endings
    .split('\n')
    .map(line => line.trimEnd()) // Trim trailing spaces on each line
    .join('\n')
    .trim();                     // Trim leading/trailing empty lines

// ─────────────────────────────────────────────
//  Core Piston call
// ─────────────────────────────────────────────
const runOnPiston = async (sourceCode, languageId, stdin = '') => {
  const { language, version } = getLang(languageId);

  const response = await axios.post(
    PISTON_URL,
    {
      language,
      version,
      files: [{ content: sourceCode }],
      stdin: stdin || '',
    },
    { timeout: TIMEOUT_MS }
  );

  return response.data; // { language, version, compile?, run }
};

// ─────────────────────────────────────────────
//  Public: executeCode (single input)
// ─────────────────────────────────────────────
export const executeCode = async (sourceCode, languageId, stdin = '') => {
  const data = await runOnPiston(sourceCode, languageId, stdin);

  const compileErr = data.compile?.code !== 0 && data.compile?.stderr
    ? data.compile.stderr
    : null;

  const run = data.run || {};
  const stdout = run.stdout || '';
  const stderr = run.stderr || '';
  const exited = run.code !== 0;

  if (compileErr) {
    return {
      verdict: 'Compilation Error',
      stdout: '',
      stderr: compileErr,
      compile_output: compileErr,
      exitCode: 1,
    };
  }

  if (exited && !stdout) {
    return {
      verdict: 'Runtime Error',
      stdout,
      stderr,
      compile_output: '',
      exitCode: run.code,
    };
  }

  return {
    verdict: 'Accepted',
    stdout,
    stderr,
    compile_output: '',
    exitCode: 0,
  };
};

// ─────────────────────────────────────────────
//  Public: runTestCases — main arena path
// ─────────────────────────────────────────────
export const runTestCases = async (sourceCode, languageId, testCases) => {
  const { language } = getLang(languageId);
  console.log(`⚡ Piston: running ${testCases.length} test case(s) | lang=${language}`);

  const testResults = [];
  let passedTests = 0;
  let firstFailure = null;
  let compilationErr = null;
  let totalTimeMs = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const t0 = Date.now();

    try {
      const data = await runOnPiston(sourceCode, languageId, tc.input);

      // ── Compilation error ──────────────────────────────────────
      if (data.compile && data.compile.code !== 0) {
        const errMsg = normalizeOutput(data.compile.stderr) || 'Compilation failed';
        compilationErr = errMsg;

        for (let j = i; j < testCases.length; j++) {
          testResults.push({
            testCase: j + 1,
            passed: false,
            verdict: 'Compilation Error',
            expectedOutput: testCases[j].expectedOutput,
            actualOutput: '',
            stderr: j === i ? errMsg : '',
          });
        }
        break;
      }

      const run = data.run || {};
      const actualOutput = normalizeOutput(run.stdout);
      const expectedOutput = normalizeOutput(tc.expectedOutput);

      // ── Runtime error ──────────────────────────────────────────
      if (run.code !== 0 && !run.stdout) {
        const errMsg = normalizeOutput(run.stderr) || 'Runtime Error';
        const verdict = run.signal === 'SIGKILL' ? 'Time Limit Exceeded' : 'Runtime Error';

        testResults.push({
          testCase: i + 1,
          passed: false,
          verdict,
          expectedOutput: tc.expectedOutput,
          actualOutput: '',
          stderr: errMsg,
          time: `${Date.now() - t0} ms`,
        });

        if (!firstFailure) firstFailure = verdict;
        continue;
      }

      // ── Compare output ─────────────────────────────────────────
      const passed = actualOutput === expectedOutput;
      const verdict = passed ? 'Accepted' : 'Wrong Answer';

      const elapsed = Date.now() - t0;
      totalTimeMs += elapsed;

      testResults.push({
        testCase: i + 1,
        passed,
        verdict,
        expectedOutput: tc.expectedOutput,
        actualOutput: run.stdout || '',
        stderr: run.stderr || '',
        time: `${elapsed} ms`,
      });

      if (passed) {
        passedTests++;
      } else if (!firstFailure) {
        firstFailure = verdict;
      }

    } catch (err) {
      console.error(`❌ Piston error on test case ${i + 1}:`, err.message);

      testResults.push({
        testCase: i + 1,
        passed: false,
        verdict: 'Runtime Error',
        expectedOutput: tc.expectedOutput,
        actualOutput: '',
        stderr: err.message,
      });

      if (!firstFailure) firstFailure = 'Runtime Error';
    }
  }

  const allTestsPassed = passedTests === testCases.length;

  const overallVerdict = compilationErr
    ? 'Compilation Error'
    : allTestsPassed
      ? 'Accepted'
      : firstFailure || 'Wrong Answer';

  const avgMs = testResults.length > 0 ? Math.round(totalTimeMs / testResults.length) : null;
  const runtime = avgMs != null ? `${avgMs} ms` : null;

  console.log(
    `✅ Piston done: ${overallVerdict} — ${passedTests}/${testCases.length} passed` +
    (runtime ? ` | ${runtime}` : '')
  );

  return {
    verdict: overallVerdict,
    allTestsPassed,
    testResults,
    totalTests: testCases.length,
    passedTests,
    runtime,
    memory: null, // Piston doesn't report memory
    compilationError: compilationErr,
  };
};
