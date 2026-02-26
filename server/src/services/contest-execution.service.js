/**
 * Contest Execution Service (Self-Hosted Piston)
 *
 * Optimized for contest workload (1000 users):
 * - Uses self-hosted Piston engine (works on Windows Docker Desktop)
 * - Concurrent test-case execution with configurable parallelism
 * - Same interface as other execution services for compatibility
 *
 * Exported:
 *   executeCode(sourceCode, languageId, stdin)      → SingleResult
 *   runTestCases(sourceCode, languageId, testCases)  → ExecutionResult
 */

import axios from 'axios';

// Self-hosted Piston — no API key needed
const PISTON_BASE_URL = process.env.PISTON_URL || 'http://localhost:2000';
const PISTON_EXECUTE_URL = `${PISTON_BASE_URL}/api/v2/execute`;
const TIMEOUT_MS = 30000;
const CONCURRENCY = parseInt(process.env.CONTEST_PISTON_CONCURRENCY || '6', 10); // Parallel test-case limit (non-batched mode)
const CASE_DELIMITER = '\n===CASE===\n';
const BATCH_RUN_TIMEOUT_MS = 30_000;  // 30s total for batched multi-test execution
const BATCH_HTTP_TIMEOUT_MS = 40_000; // HTTP timeout around the batched Piston call
const BATCH_LANGUAGES = new Set([71, 70]); // Python 3 & 2 support batched mode

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
  72: { language: 'ruby', version: '*' },
  60: { language: 'go', version: '*' },
  73: { language: 'rust', version: '*' },
  78: { language: 'kotlin', version: '*' },
  70: { language: 'python', version: '*' }, // Python 2 fallback
  998: { language: 'fortran', version: '*' },
  999: { language: 'd', version: '*' },
};

const getLang = (languageId) =>
  LANG_MAP[languageId] || { language: 'python', version: '*' };

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const normalize = (s) => (s || '').trim().replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────
//  Core Piston call
// ─────────────────────────────────────────────
const runOnPiston = async (sourceCode, languageId, stdin = '') => {
  const { language, version } = getLang(languageId);

  const response = await axios.post(
    PISTON_EXECUTE_URL,
    {
      language,
      version,
      files: [{ content: sourceCode }],
      stdin: stdin || '',
      run_timeout: 3000,      // 3s per test case
      compile_timeout: 10000, // 10s max compile time
    },
    { timeout: TIMEOUT_MS }
  );

  return response.data; // { language, version, compile?, run }
};

// ─────────────────────────────────────────────
//  Run N promises with concurrency limit
// ─────────────────────────────────────────────
const runWithConcurrency = async (tasks, limit) => {
  const results = new Array(tasks.length);
  let idx = 0;

  const worker = async () => {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  };

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
};

// ─────────────────────────────────────────────
//  Batched execution (all test cases in 1 Piston call)
// ─────────────────────────────────────────────

/**
 * Build a Python wrapper that runs user code against every test case
 * in a single process.  User code is embedded as base64 to avoid escaping.
 */
const buildPythonBatchRunner = (sourceCode) => {
  const b64 = Buffer.from(sourceCode, 'utf-8').toString('base64');
  return [
    'import sys, io, traceback, base64',
    "SEP = '\\n===CASE===\\n'",
    'all_input = sys.stdin.read()',
    'cases = all_input.split(SEP)',
    `code = base64.b64decode('${b64}').decode('utf-8')`,
    'try:',
    "    cc = compile(code, 'solution.py', 'exec')",
    'except SyntaxError as e:',
    "    err = '__CE__:SyntaxError: ' + str(e)",
    "    print(SEP.join([err] * len(cases)), end='')",
    '    sys.exit(0)',
    'outs = []',
    'for c in cases:',
    '    sys.stdin = io.StringIO(c)',
    '    buf = io.StringIO()',
    '    sys.stdout = buf',
    '    try:',
    "        exec(cc, {'__name__': '__main__', '__builtins__': __builtins__})",
    '    except SystemExit:',
    '        pass',
    '    except Exception:',
    "        tb = traceback.format_exc().strip().split('\\n')",
    "        buf.write('__RT_ERR__:' + (tb[-1] if tb else 'Unknown error'))",
    '    sys.stdout = sys.__stdout__',
    '    outs.append(buf.getvalue())',
    'sys.stdout = sys.__stdout__',
    "print(SEP.join(outs), end='')",
  ].join('\n');
};

/** Build a uniform all-fail result (CE / TLE / Internal Error). */
const buildAllFailResult = (testCases, verdict, errMsg, elapsed) => {
  const testResults = testCases.map((tc, i) => ({
    testCase: i + 1,
    passed: false,
    verdict,
    expectedOutput: tc.expectedOutput,
    actualOutput: '',
    stderr: i === 0 ? errMsg : `${verdict} (see test case 1)`,
    time: i === 0 ? `${elapsed} ms` : null,
  }));
  return {
    verdict,
    allTestsPassed: false,
    testResults,
    totalTests: testCases.length,
    passedTests: 0,
    runtime: `${elapsed} ms`,
    memory: null,
    compilationError: verdict === 'Compilation Error' ? errMsg : null,
  };
};

/**
 * Run ALL test cases inside a single Piston process.
 * Currently supported: Python 3 / 2.
 * 100 test cases → 1 HTTP call → ~2-5 seconds.
 */
const runBatchedTestCases = async (sourceCode, languageId, testCases) => {
  const { language } = getLang(languageId);
  console.log(
    `⚡ BATCHED execution: ${testCases.length} test case(s), lang=${language} → 1 Piston call`
  );

  const batchedStdin = testCases.map((tc) => tc.input || '').join(CASE_DELIMITER);
  const runnerCode = buildPythonBatchRunner(sourceCode);

  const t0 = Date.now();
  try {
    const response = await axios.post(
      PISTON_EXECUTE_URL,
      {
        language,
        version: '*',
        files: [{ name: 'runner.py', content: runnerCode }],
        stdin: batchedStdin,
        run_timeout: BATCH_RUN_TIMEOUT_MS,
        compile_timeout: 10_000,
      },
      { timeout: BATCH_HTTP_TIMEOUT_MS },
    );

    const data = response.data;
    const elapsed = Date.now() - t0;

    // Compile error at runner level
    if (data.compile && data.compile.code !== 0) {
      return buildAllFailResult(
        testCases, 'Compilation Error',
        normalize(data.compile.stderr) || 'Compilation failed', elapsed,
      );
    }

    const run = data.run || {};

    // Whole process killed (TLE / OOM)
    if (run.signal === 'SIGKILL') {
      return buildAllFailResult(
        testCases, 'Time Limit Exceeded',
        'Process exceeded time limit', elapsed,
      );
    }

    // Runner crashed without output
    if (run.code !== 0 && !run.stdout) {
      return buildAllFailResult(
        testCases, 'Runtime Error',
        normalize(run.stderr) || 'Runtime Error', elapsed,
      );
    }

    // ── Parse per-test-case outputs ──
    const rawOutput = run.stdout || '';
    const outputParts = rawOutput.split(CASE_DELIMITER);

    const testResults = [];
    let passedTests = 0;
    let firstFailure = null;
    let compilationErr = null;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];

      // Process was killed before producing output for this case
      if (i >= outputParts.length) {
        testResults.push({
          testCase: i + 1, passed: false, verdict: 'Time Limit Exceeded',
          expectedOutput: tc.expectedOutput, actualOutput: '',
          stderr: 'Process terminated before reaching this test case', time: null,
        });
        if (!firstFailure) firstFailure = 'Time Limit Exceeded';
        continue;
      }

      const actualRaw = outputParts[i] || '';
      const actual = normalize(actualRaw);
      const expected = normalize(tc.expectedOutput);

      // Compilation error marker
      if (actual.startsWith('__CE__:')) {
        const msg = actual.slice(6);
        compilationErr = compilationErr || msg;
        testResults.push({
          testCase: i + 1, passed: false, verdict: 'Compilation Error',
          expectedOutput: tc.expectedOutput, actualOutput: '',
          stderr: msg, time: `${elapsed} ms`,
        });
        if (!firstFailure) firstFailure = 'Compilation Error';
        continue;
      }

      // Runtime error marker
      if (actual.startsWith('__RT_ERR__:')) {
        const msg = actual.slice(10);
        testResults.push({
          testCase: i + 1, passed: false, verdict: 'Runtime Error',
          expectedOutput: tc.expectedOutput, actualOutput: '',
          stderr: msg, time: `${elapsed} ms`,
        });
        if (!firstFailure) firstFailure = 'Runtime Error';
        continue;
      }

      // Compare output
      const passed = actual === expected;
      testResults.push({
        testCase: i + 1,
        passed,
        verdict: passed ? 'Accepted' : 'Wrong Answer',
        expectedOutput: tc.expectedOutput,
        actualOutput: actualRaw.trim(),
        stderr: '',
        time: `${Math.round(elapsed / testCases.length)} ms`,
      });
      if (passed) passedTests++;
      else if (!firstFailure) firstFailure = 'Wrong Answer';
    }

    const allPassed = passedTests === testCases.length;
    const verdict = compilationErr
      ? 'Compilation Error'
      : allPassed
        ? 'Accepted'
        : firstFailure || 'Wrong Answer';

    console.log(
      `✅ Batched done: ${verdict} — ${passedTests}/${testCases.length} passed in ${elapsed}ms`
    );

    return {
      verdict,
      allTestsPassed: allPassed,
      testResults,
      totalTests: testCases.length,
      passedTests,
      runtime: `${elapsed} ms`,
      memory: null,
      compilationError: compilationErr,
    };
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error('❌ Batched execution error:', err.message);
    return buildAllFailResult(testCases, 'Internal Error', err.message, elapsed);
  }
};

// ─────────────────────────────────────────────
//  Public: executeCode (single stdin/stdout)
// ─────────────────────────────────────────────
export const executeCode = async (sourceCode, languageId, stdin = '') => {
  try {
    const data = await runOnPiston(sourceCode, languageId, stdin);

    // Compilation error
    const compileErr =
      data.compile && data.compile.code !== 0 && data.compile.stderr
        ? data.compile.stderr
        : null;

    if (compileErr) {
      return {
        verdict: 'Compilation Error',
        stdout: '',
        stderr: compileErr,
        compile_output: compileErr,
        exitCode: 1,
        time: null,
        memory: null,
      };
    }

    const run = data.run || {};
    const stdout = run.stdout || '';
    const stderr = run.stderr || '';

    // Runtime error
    if (run.code !== 0 && !stdout) {
      return {
        verdict: run.signal === 'SIGKILL' ? 'Time Limit Exceeded' : 'Runtime Error',
        stdout,
        stderr,
        compile_output: '',
        exitCode: run.code,
        time: null,
        memory: null,
      };
    }

    return {
      verdict: 'Accepted',
      stdout,
      stderr,
      compile_output: '',
      exitCode: 0,
      time: null,
      memory: null,
    };
  } catch (err) {
    console.error('❌ Contest Piston execution error:', err.message);
    return {
      verdict: 'Internal Error',
      stdout: '',
      stderr: err.message,
      compile_output: '',
      exitCode: 1,
      time: null,
      memory: null,
    };
  }
};

// ─────────────────────────────────────────────
//  Public: runTestCases — concurrent execution
// ─────────────────────────────────────────────
export const runTestCases = async (sourceCode, languageId, testCases) => {
  // ── Batched mode: Python sends ALL test cases in 1 Piston call ──
  if (BATCH_LANGUAGES.has(languageId) && testCases.length > 1) {
    return runBatchedTestCases(sourceCode, languageId, testCases);
  }

  // ── Per-test-case mode (JS, Java, C++, etc.) with high concurrency ──
  const { language } = getLang(languageId);
  console.log(`⚡ Contest Piston: running ${testCases.length} test case(s), lang=${language}, concurrency=${CONCURRENCY}`);

  const testResults = [];
  let passedTests = 0;
  let firstFailure = null;
  let compilationErr = null;
  let totalTimeMs = 0;

  // Build tasks for concurrent execution
  const tasks = testCases.map((tc, i) => async () => {
    const t0 = Date.now();
    try {
      const data = await runOnPiston(sourceCode, languageId, tc.input);
      return { index: i, data, elapsed: Date.now() - t0, error: null };
    } catch (err) {
      return { index: i, data: null, elapsed: Date.now() - t0, error: err };
    }
  });

  // Execute with concurrency limit
  const rawResults = await runWithConcurrency(tasks, CONCURRENCY);

  // Process results in order
  for (let i = 0; i < rawResults.length; i++) {
    const { data, elapsed, error } = rawResults[i];
    const tc = testCases[i];

    // Network / internal error
    if (error || !data) {
      testResults.push({
        testCase: i + 1,
        passed: false,
        verdict: 'Runtime Error',
        expectedOutput: tc.expectedOutput,
        actualOutput: '',
        stderr: error?.message || 'No response from execution engine',
        time: `${elapsed} ms`,
      });
      if (!firstFailure) firstFailure = 'Runtime Error';
      continue;
    }

    // Compilation error
    if (data.compile && data.compile.code !== 0) {
      const errMsg = normalize(data.compile.stderr) || 'Compilation failed';
      if (!compilationErr) compilationErr = errMsg;

      // Mark remaining test cases as CE too
      for (let j = i; j < testCases.length; j++) {
        if (j > i && testResults[j]) continue; // already processed concurrently
        testResults[j] = {
          testCase: j + 1,
          passed: false,
          verdict: 'Compilation Error',
          expectedOutput: testCases[j].expectedOutput,
          actualOutput: '',
          stderr: j === i ? errMsg : 'Compilation Error (see first test case)',
          time: j === i ? `${elapsed} ms` : null,
        };
      }
      if (!firstFailure) firstFailure = 'Compilation Error';
      continue;
    }

    const run = data.run || {};
    const actualOutput = normalize(run.stdout);
    const expectedOutput = normalize(tc.expectedOutput);

    // Runtime error / TLE
    if (run.code !== 0 && !run.stdout) {
      const verdict = run.signal === 'SIGKILL' ? 'Time Limit Exceeded' : 'Runtime Error';
      const errMsg = normalize(run.stderr) || verdict;

      testResults.push({
        testCase: i + 1,
        passed: false,
        verdict,
        expectedOutput: tc.expectedOutput,
        actualOutput: '',
        stderr: errMsg,
        time: `${elapsed} ms`,
      });
      if (!firstFailure) firstFailure = verdict;
      continue;
    }

    // Compare output
    const passed = actualOutput === expectedOutput;
    const verdict = passed ? 'Accepted' : 'Wrong Answer';

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
    `✅ Contest Piston done: ${overallVerdict} — ${passedTests}/${testCases.length} passed` +
    (runtime ? ` | ${runtime}` : '')
  );

  return {
    verdict: overallVerdict,
    allTestsPassed,
    testResults,
    totalTests: testCases.length,
    passedTests,
    runtime,
    memory: null, // Piston doesn't report memory usage
    compilationError: compilationErr,
  };
};
