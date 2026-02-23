/**
 * JDoodle Code Execution Service
 *
 * Free tier: 200 executions/day, no credit card — just email signup.
 * Sign up at: https://www.jdoodle.com/compiler-api
 * Add to .env:  JDOODLE_CLIENT_ID=your_id  JDOODLE_CLIENT_SECRET=your_secret
 *
 * Drop-in replacement for judge0.service.js — same exported interface:
 *   runTestCases(sourceCode, languageId, testCases) → ExecutionResult
 *   executeCode(sourceCode, languageId, stdin)      → SingleResult
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const JDOODLE_URL    = 'https://api.jdoodle.com/v1/execute';
const CLIENT_ID      = process.env.JDOODLE_CLIENT_ID     || '';
const CLIENT_SECRET  = process.env.JDOODLE_CLIENT_SECRET || '';
const TIMEOUT_MS     = 15000;

// Check if configured
export const jdoodleIsConfigured = !!(CLIENT_ID && CLIENT_SECRET);

if (!jdoodleIsConfigured) {
  console.warn(
    '⚠️  JDoodle: No credentials found.\n' +
    '   Sign up free at https://www.jdoodle.com/compiler-api\n' +
    '   Then set JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET in .env'
  );
}

// ─────────────────────────────────────────────
//  Judge0 language ID → JDoodle language/version
// ─────────────────────────────────────────────
const LANG_MAP = {
  71: { language: 'python3',  versionIndex: '3' },   // Python 3
  63: { language: 'nodejs',   versionIndex: '4' },   // JavaScript (Node)
  62: { language: 'java',     versionIndex: '4' },   // Java
  54: { language: 'cpp17',    versionIndex: '1' },   // C++17
  50: { language: 'c',        versionIndex: '5' },   // C
  51: { language: 'csharp',   versionIndex: '4' },   // C#
};

const getLang = (languageId) =>
  LANG_MAP[languageId] || { language: 'python3', versionIndex: '3' };

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const normalizeOutput = (s) => (s || '').trim().replace(/\r\n/g, '\n');

const isCompileError = (output) => {
  if (!output) return false;
  const lower = output.toLowerCase();
  return (
    lower.includes('syntaxerror') ||
    lower.includes('compileerror') ||
    lower.includes('error:') ||
    lower.includes('exception in thread "main"') ||
    (lower.includes('line') && lower.includes('error'))
  );
};

// ─────────────────────────────────────────────
//  Core JDoodle call
// ─────────────────────────────────────────────
const runOnJDoodle = async (sourceCode, languageId, stdin = '') => {
  const { language, versionIndex } = getLang(languageId);

  const response = await axios.post(
    JDOODLE_URL,
    {
      clientId:     CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      script:       sourceCode,
      language,
      versionIndex,
      stdin:        stdin || '',
    },
    { timeout: TIMEOUT_MS }
  );

  // JDoodle returns: { output, statusCode, memory, cpuTime }
  // statusCode: 200 = success, 400 = bad request, 429 = quota exceeded
  return response.data;
};

// ─────────────────────────────────────────────
//  Public: executeCode (single input)
// ─────────────────────────────────────────────
export const executeCode = async (sourceCode, languageId, stdin = '') => {
  if (!jdoodleIsConfigured) {
    throw new Error('JDoodle not configured. Set JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET in .env');
  }

  const data = await runOnJDoodle(sourceCode, languageId, stdin);
  const output = data.output || '';

  if (isCompileError(output)) {
    return {
      verdict:        'Compilation Error',
      stdout:         '',
      stderr:         output,
      compile_output: output,
      exitCode:       1,
    };
  }

  return {
    verdict:        'Accepted',
    stdout:         output,
    stderr:         '',
    compile_output: '',
    exitCode:       0,
    time:           data.cpuTime   ? `${data.cpuTime} s`   : null,
    memory:         data.memory    ? `${data.memory} KB`   : null,
  };
};

// ─────────────────────────────────────────────
//  Public: runTestCases — main arena path
// ─────────────────────────────────────────────
export const runTestCases = async (sourceCode, languageId, testCases) => {
  if (!jdoodleIsConfigured) {
    console.error('❌ JDoodle not configured — returning error');
    const errorResults = testCases.map((tc, i) => ({
      testCase:       i + 1,
      passed:         false,
      verdict:        'Configuration Error',
      expectedOutput: tc.expectedOutput,
      actualOutput:   '',
      stderr:         'Set JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET in .env',
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

  const { language } = getLang(languageId);
  console.log(`⚡ JDoodle: running ${testCases.length} test case(s) | lang=${language}`);

  const testResults  = [];
  let passedTests    = 0;
  let firstFailure   = null;
  let compilationErr = null;
  let totalTimeMs    = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const t0 = Date.now();

    try {
      const data   = await runOnJDoodle(sourceCode, languageId, tc.input);
      const output = data.output || '';

      // ── Quota exceeded ────────────────────────────────────────
      if (data.statusCode === 429 || output.includes('Quota')) {
        const errMsg = 'JDoodle daily quota (200/day) exceeded. Try again tomorrow.';
        console.error('❌', errMsg);
        for (let j = i; j < testCases.length; j++) {
          testResults.push({
            testCase:       j + 1,
            passed:         false,
            verdict:        'Runtime Error',
            expectedOutput: testCases[j].expectedOutput,
            actualOutput:   '',
            stderr:         errMsg,
          });
        }
        firstFailure = 'Runtime Error';
        break;
      }

      // ── Compilation error ─────────────────────────────────────
      if (isCompileError(output)) {
        compilationErr = output;
        for (let j = i; j < testCases.length; j++) {
          testResults.push({
            testCase:       j + 1,
            passed:         false,
            verdict:        'Compilation Error',
            expectedOutput: testCases[j].expectedOutput,
            actualOutput:   '',
            stderr:         j === i ? output : '',
          });
        }
        break;
      }

      // ── Compare output ────────────────────────────────────────
      const actualOutput   = normalizeOutput(output);
      const expectedOutput = normalizeOutput(tc.expectedOutput);
      const passed         = actualOutput === expectedOutput;
      const verdict        = passed ? 'Accepted' : 'Wrong Answer';

      const elapsed = Date.now() - t0;
      totalTimeMs  += elapsed;

      testResults.push({
        testCase:       i + 1,
        passed,
        verdict,
        expectedOutput: tc.expectedOutput,
        actualOutput:   output,
        stderr:         '',
        time:           data.cpuTime ? `${data.cpuTime} s` : `${elapsed} ms`,
        memory:         data.memory  ? `${data.memory} KB` : null,
      });

      if (passed) {
        passedTests++;
      } else if (!firstFailure) {
        firstFailure = verdict;
      }

    } catch (err) {
      console.error(`❌ JDoodle error on test ${i + 1}:`, err.message);
      testResults.push({
        testCase:       i + 1,
        passed:         false,
        verdict:        'Runtime Error',
        expectedOutput: tc.expectedOutput,
        actualOutput:   '',
        stderr:         err.message,
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

  const avgMs  = testResults.length > 0 ? Math.round(totalTimeMs / testResults.length) : null;
  const runtime = avgMs != null ? `${avgMs} ms` : null;

  console.log(`✅ JDoodle done: ${overallVerdict} — ${passedTests}/${testCases.length} passed`);

  return {
    verdict:          overallVerdict,
    allTestsPassed,
    testResults,
    totalTests:       testCases.length,
    passedTests,
    runtime,
    memory:           null,
    compilationError: compilationErr,
  };
};
