/**
 * Test: Batched execution (100 test cases → 1 Piston call)
 *
 * Run:  node test-batched-execution.mjs
 *
 * Prerequisites: Piston running on port 2000 (docker)
 */

import { runTestCases } from './src/services/contest-execution.service.js';

const PYTHON_LANG_ID = 71; // Python 3
const JS_LANG_ID = 63;     // JavaScript / Node

// ─── Helper ──────────────────────────────────
const run = async (label, sourceCode, languageId, testCases) => {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`TEST: ${label}  (${testCases.length} test cases, langId=${languageId})`);
  console.log('─'.repeat(60));
  const t0 = Date.now();
  const result = await runTestCases(sourceCode, languageId, testCases);
  const ms = Date.now() - t0;
  console.log(`  Verdict : ${result.verdict}`);
  console.log(`  Passed  : ${result.passedTests}/${result.totalTests}`);
  console.log(`  Time    : ${ms}ms total`);
  if (result.compilationError) console.log(`  CE      : ${result.compilationError}`);
  // Show first failure detail (if any)
  const fail = result.testResults.find((r) => !r.passed);
  if (fail) {
    console.log(`  1st fail: TC#${fail.testCase} — ${fail.verdict}`);
    if (fail.stderr) console.log(`           stderr: ${fail.stderr.slice(0, 120)}`);
    if (fail.expectedOutput) console.log(`           expected: ${fail.expectedOutput.trim().slice(0, 60)}`);
    if (fail.actualOutput) console.log(`           actual  : ${fail.actualOutput.trim().slice(0, 60)}`);
  }
  return { result, ms };
};

// ─── Test 1: Python — 100 test cases (A+B sum) ──────────────────
const makeAddTestCases = (n) =>
  Array.from({ length: n }, (_, i) => ({
    input: `${i + 1} ${i * 2}\n`,
    expectedOutput: `${i + 1 + i * 2}\n`,
  }));

const pythonAdd = `a, b = map(int, input().split())
print(a + b)
`;

// ─── Test 2: Python — 60 test cases (factorial) ─────────────────
const factorial = (n) => {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r.toString();
};

const makeFactorialCases = (n) =>
  Array.from({ length: n }, (_, i) => ({
    input: `${i + 1}\n`,
    expectedOutput: `${factorial(i + 1)}\n`,
  }));

const pythonFactorial = `import math
n = int(input())
print(math.factorial(n))
`;

// ─── Test 3: Python — syntax error (should report CE for all) ──
const pythonBadCode = `def foo(
  print("oops")
`;

// ─── Test 4: Python — runtime error on some cases ──────────────
const pythonDiv = `a, b = map(int, input().split())
print(a // b)
`;
const divCases = [
  { input: '10 2\n', expectedOutput: '5\n' },
  { input: '9 3\n', expectedOutput: '3\n' },
  { input: '7 0\n', expectedOutput: '0\n' },  // division by zero!
  { input: '8 4\n', expectedOutput: '2\n' },
];

// ─── Test 5: JavaScript — 20 test cases (per-test-case mode) ───
const jsAdd = `process.stdin.setEncoding('utf8');
let _d = '';
process.stdin.on('data', c => _d += c);
process.stdin.on('end', () => {
  const [a, b] = _d.trim().split(' ').map(Number);
  console.log(a + b);
});
`;

// ─── Run all tests ──────────────────────────────────────────────
const main = async () => {
  console.log('🧪 Batched Execution Test Suite\n');
  let passed = 0;
  let total = 0;

  // Test 1: Python 100 test cases (batched)
  total++;
  const t1 = await run('Python 100 test cases (A+B)', pythonAdd, PYTHON_LANG_ID, makeAddTestCases(100));
  if (t1.result.verdict === 'Accepted' && t1.result.passedTests === 100) {
    console.log('  ✅ PASSED');
    passed++;
  } else {
    console.log('  ❌ FAILED');
  }

  // Test 2: Python 60 factorial cases (batched)
  total++;
  const t2 = await run('Python 60 test cases (factorial)', pythonFactorial, PYTHON_LANG_ID, makeFactorialCases(60));
  if (t2.result.verdict === 'Accepted' && t2.result.passedTests === 60) {
    console.log('  ✅ PASSED');
    passed++;
  } else {
    console.log('  ❌ FAILED');
  }

  // Test 3: Python CE (batched)
  total++;
  const t3 = await run('Python syntax error (CE)', pythonBadCode, PYTHON_LANG_ID, makeAddTestCases(5));
  if (t3.result.verdict === 'Compilation Error') {
    console.log('  ✅ PASSED (correctly detected CE)');
    passed++;
  } else {
    console.log('  ❌ FAILED — expected Compilation Error');
  }

  // Test 4: Python runtime error (batched)
  total++;
  const t4 = await run('Python runtime error (div by zero)', pythonDiv, PYTHON_LANG_ID, divCases);
  if (t4.result.passedTests === 3 && t4.result.testResults[2].verdict === 'Runtime Error') {
    console.log('  ✅ PASSED (3 passed, TC#3 runtime error — independent test cases)');
    passed++;
  } else {
    console.log('  ❌ FAILED');
  }

  // Test 5: JS 20 test cases (per-test-case, high concurrency)
  total++;
  const t5 = await run('JS 20 test cases (per-case mode)', jsAdd, JS_LANG_ID, makeAddTestCases(20));
  if (t5.result.verdict === 'Accepted' && t5.result.passedTests === 20) {
    console.log('  ✅ PASSED');
    passed++;
  } else {
    console.log('  ❌ FAILED');
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  RESULTS: ${passed}/${total} tests passed`);
  if (passed === total) {
    console.log('  🎉 All tests passed! Batched execution working correctly.');
  } else {
    console.log('  ⚠️  Some tests failed. Check output above.');
  }
  console.log('═'.repeat(60));
  process.exit(passed === total ? 0 : 1);
};

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
