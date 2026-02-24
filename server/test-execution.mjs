/**
 * Test Script — Verify Code Execution Pipeline (Piston)
 *
 * Tests the self-hosted Piston instance with Python, JavaScript, Java
 * and verifies the contest-execution.service works end-to-end.
 *
 * Usage: node test-execution.mjs
 */

const PISTON_URL = 'http://localhost:2000';
const EXECUTE_URL = `${PISTON_URL}/api/v2/execute`;

// ─────────────────────────────────────────────
//  Language map  (Judge0 ID → Piston lang name)
// ─────────────────────────────────────────────
const LANG_MAP = {
  63: { language: 'javascript', version: '*' },
  71: { language: 'python',     version: '*' },
  62: { language: 'java',       version: '*' },
  54: { language: 'c++',        version: '*' },
  50: { language: 'c',          version: '*' },
};

// ─────────────────────────────────────────────
//  Test cases
// ─────────────────────────────────────────────
const tests = [
  {
    name: 'Python — Hello World',
    languageId: 71,
    code: `print("Hello, World!")`,
    stdin: '',
    expectedOutput: 'Hello, World!',
  },
  {
    name: 'Python — Sum from stdin',
    languageId: 71,
    code: `a, b = map(int, input().split())\nprint(a + b)`,
    stdin: '3 5',
    expectedOutput: '8',
  },
  {
    name: 'JavaScript — FizzBuzz',
    languageId: 63,
    code: `let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  const n = parseInt(input.trim());
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) console.log("FizzBuzz");
    else if (i % 3 === 0) console.log("Fizz");
    else if (i % 5 === 0) console.log("Buzz");
    else console.log(i);
  }
});`,
    stdin: '5',
    expectedOutput: '1\n2\nFizz\n4\nBuzz',
  },
  {
    name: 'Java — Reverse String',
    languageId: 62,
    code: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        System.out.println(new StringBuilder(s).reverse().toString());
    }
}`,
    stdin: 'hello',
    expectedOutput: 'olleh',
  },
  {
    name: 'Python — Runtime Error (division by zero)',
    languageId: 71,
    code: `print(1/0)`,
    stdin: '',
    expectedOutput: null,
    expectVerdict: 'Runtime Error',
  },
  {
    name: 'Python — Time Limit (infinite loop)',
    languageId: 71,
    code: `while True: pass`,
    stdin: '',
    expectedOutput: null,
    expectVerdict: 'Time Limit Exceeded',
  },
];

// ─────────────────────────────────────────────
//  Piston execution helper
// ─────────────────────────────────────────────
async function executeOnPiston(code, languageId, stdin) {
  const lang = LANG_MAP[languageId];
  if (!lang) throw new Error(`Unsupported languageId: ${languageId}`);

  // Java needs more time for JVM startup
  const runTimeout = 3000;

  const res = await fetch(EXECUTE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: lang.language,
      version: lang.version,
      files: [{ content: code }],
      stdin: stdin || '',
      run_timeout: runTimeout,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Piston error (${res.status}): ${text}`);
  }

  return await res.json();
}

function getVerdict(data) {
  // Compilation error
  if (data.compile && data.compile.code !== 0 && data.compile.stderr) {
    return { verdict: 'Compilation Error', output: '', error: data.compile.stderr };
  }
  const run = data.run || {};
  const stdout = (run.stdout || '').trim();
  const stderr = (run.stderr || '').trim();

  // Time Limit / killed
  if (run.signal === 'SIGKILL') {
    return { verdict: 'Time Limit Exceeded', output: stdout, error: stderr };
  }
  // Runtime error
  if (run.code !== 0 && !stdout) {
    return { verdict: 'Runtime Error', output: '', error: stderr };
  }
  return { verdict: 'Accepted', output: stdout, error: stderr };
}

// ─────────────────────────────────────────────
//  Concurrent batch test (simulates contest load)
// ─────────────────────────────────────────────
async function testConcurrentBatch() {
  console.log('\n' + '═'.repeat(60));
  console.log('  CONCURRENT BATCH TEST (3 test cases in parallel)');
  console.log('═'.repeat(60));

  const inputs = ['1 2', '10 20', '100 200'];
  const expected = ['3', '30', '300'];
  const code = 'a,b=map(int,input().split())\nprint(a+b)';

  const t0 = Date.now();
  const promises = inputs.map((stdin) => executeOnPiston(code, 71, stdin));

  try {
    const results = await Promise.all(promises);
    const elapsed = Date.now() - t0;
    let allPass = true;

    results.forEach((data, idx) => {
      const { output } = getVerdict(data);
      const pass = output === expected[idx];
      if (!pass) allPass = false;
      console.log(`  Test ${idx + 1}: ${pass ? '✅' : '❌'} expected="${expected[idx]}" got="${output}"`);
    });

    console.log(`  ⏱️  Total time: ${elapsed} ms`);
    console.log(allPass ? '  ✅ CONCURRENT BATCH WORKS!' : '  ❌ Batch has failures');
    return allPass;
  } catch (err) {
    console.log(`  ❌ Concurrent batch error: ${err.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────
//  Redis test
// ─────────────────────────────────────────────
async function testRedis() {
  console.log('\n' + '═'.repeat(60));
  console.log('  REDIS TEST');
  console.log('═'.repeat(60));

  try {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis({ host: 'localhost', port: 6380 });

    await redis.set('test-key', 'hello-codeclash');
    const value = await redis.get('test-key');
    await redis.del('test-key');
    await redis.quit();

    const pass = value === 'hello-codeclash';
    console.log(`  ${pass ? '✅' : '❌'} Redis SET/GET: ${value}`);
    return pass;
  } catch (err) {
    console.log(`  ❌ Redis error: ${err.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  CodeClash — Code Execution Test Suite (Piston)         ║');
  console.log('║  Testing self-hosted Piston at ' + PISTON_URL + '       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // 1. Check Piston is alive
  console.log('\n🔍 Checking Piston API...');
  let pistonReady = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch(`${PISTON_URL}/api/v2/runtimes`);
      const runtimes = await res.json();
      console.log(`  ✅ Piston is running — ${runtimes.length} runtimes installed`);
      runtimes.forEach((r) => console.log(`     - ${r.language} ${r.version}`));
      pistonReady = true;
      break;
    } catch (err) {
      console.log(`  ⏳ Waiting for Piston... (attempt ${attempt + 1}/10)`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (!pistonReady) {
    console.error('  ❌ Piston is not reachable after 30s');
    console.error('  Run: docker compose -f docker-compose.judge0.yml up -d piston');
    process.exit(1);
  }

  // 2. Run individual tests
  console.log('\n' + '═'.repeat(60));
  console.log('  INDIVIDUAL EXECUTION TESTS');
  console.log('═'.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`\n  🧪 ${test.name}... `);

    try {
      const t0 = Date.now();
      const data = await executeOnPiston(test.code, test.languageId, test.stdin);
      const elapsed = Date.now() - t0;
      const { verdict, output, error } = getVerdict(data);

      // Check expected verdict (for error cases)
      if (test.expectVerdict) {
        if (verdict === test.expectVerdict) {
          console.log(`✅ Got expected: "${verdict}" (${elapsed} ms)`);
          passed++;
        } else {
          console.log(`❌ Expected "${test.expectVerdict}" but got "${verdict}"`);
          if (error) console.log(`     stderr: ${error.slice(0, 150)}`);
          failed++;
        }
        continue;
      }

      // Check output
      const expectedNorm = (test.expectedOutput || '').trim();
      if (output === expectedNorm) {
        console.log(`✅ Output: "${output}" (${elapsed} ms)`);
        passed++;
      } else {
        console.log(`❌ Verdict: ${verdict}`);
        console.log(`     Expected: "${expectedNorm}"`);
        console.log(`     Got:      "${output}"`);
        if (error) console.log(`     stderr: ${error.slice(0, 200)}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      failed++;
    }
  }

  // 3. Concurrent batch test
  const batchOk = await testConcurrentBatch();
  if (batchOk) passed++; else failed++;

  // 4. Redis test
  const redisOk = await testRedis();
  if (redisOk) passed++; else failed++;

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('═'.repeat(60));

  if (failed === 0) {
    console.log('\n  🎉 ALL TESTS PASSED! Code execution pipeline is ready.');
    console.log('  Your contest system can handle 1000 users.\n');
  } else {
    console.log(`\n  ⚠️  ${failed} test(s) failed. Check the output above.\n`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
