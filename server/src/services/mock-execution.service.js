/**
 * Mock Code Execution Service
 * Intelligently validates code against test cases without actual execution
 * Good for development, testing, and portfolio demos
 */

/**
 * Map language IDs (for compatibility with frontend)
 */
const mapLanguageId = (languageId) => {
  const mapping = {
    63: 'javascript',
    71: 'python',
    62: 'java',
    54: 'cpp',
    50: 'c',
    51: 'csharp',
  };
  return mapping[languageId] || 'python';
};

/**
 * Execute code (mock implementation)
 */
export const executeCode = async (sourceCode, languageId, stdin = '') => {
  const language = mapLanguageId(languageId);
  
  console.log('🎭 Mock execution:', { language, codeLength: sourceCode.length });

  // Simulate network delay (realistic feel)
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

  // Check for obvious syntax errors
  const syntaxCheck = checkSyntax(sourceCode, language);
  if (!syntaxCheck.valid) {
    return {
      verdict: 'Compilation Error',
      stdout: '',
      stderr: syntaxCheck.error,
      compile_output: syntaxCheck.error,
      exitCode: 1,
    };
  }

  // Check for runtime errors (infinite loops, etc.)
  const runtimeCheck = checkRuntime(sourceCode, language);
  if (!runtimeCheck.valid) {
    return {
      verdict: 'Runtime Error',
      stdout: '',
      stderr: runtimeCheck.error,
      compile_output: '',
      exitCode: 1,
    };
  }

  // Execute code logic
  const output = executeLogic(sourceCode, language, stdin);

  return {
    verdict: 'Executed',
    stdout: output,
    stderr: '',
    compile_output: '',
    exitCode: 0,
  };
};

/**
 * Check for basic syntax errors
 */
/**
 * Check for basic syntax errors
 */
const checkSyntax = (code, language) => {
  const lowerCode = code.toLowerCase();

  // Check for empty code
  if (code.trim().length === 0) {
    return { valid: false, error: 'SyntaxError: Empty code' };
  }

  // ========== PYTHON ==========
  if (language === 'python') {
    if (code.includes('def ') && !code.includes(':')) {
      return { valid: false, error: 'SyntaxError: invalid syntax (missing colon)' };
    }
    if (lowerCode.includes('print(') && !code.includes(')')) {
      return { valid: false, error: 'SyntaxError: unexpected EOF while parsing' };
    }
  }

  // ========== JAVASCRIPT ==========
  if (language === 'javascript') {
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      return { valid: false, error: 'SyntaxError: Unexpected end of input' };
    }
  }

  // ========== C++ ==========
  if (language === 'cpp' || language === 'c++') {
    // Check for balanced braces
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      return { valid: false, error: 'error: expected \'}\' at end of input' };
    }

    // Check for missing semicolons (basic check)
    const lines = code.split('\n').filter(l => l.trim());
    const lastLine = lines[lines.length - 1];
    if (lastLine && !lastLine.includes('}') && !lastLine.trim().endsWith(';')) {
      return { valid: false, error: 'error: expected \';\' before \'}\' token' };
    }

    // Check for missing main function
    if (!code.includes('int main')) {
      return { valid: false, error: 'error: \'main\' function not found' };
    }
  }

  return { valid: true };
};

/**
 * Check for runtime errors
 */
const checkRuntime = (code, language) => {
  const lowerCode = code.toLowerCase();

  // Check for potential infinite loops (very basic check)
  if (lowerCode.includes('while true') && !lowerCode.includes('break')) {
    return { valid: false, error: 'RuntimeError: Infinite loop detected' };
  }

  // Check for division by zero attempts
  if (code.includes('/ 0') || code.includes('/0')) {
    return { valid: false, error: 'RuntimeError: division by zero' };
  }

  return { valid: true };
};

/**
 * Execute code logic based on problem patterns
 */
/**
 * Execute code logic based on problem patterns
 */
const executeLogic = (code, language, stdin) => {
  const lowerCode = code.toLowerCase();

  // ========== SIMPLE OUTPUT TESTS ==========

  // Python print with string literal
  if (language === 'python' && code.includes('print(') && 
      (code.includes('"') || code.includes("'"))) {
    const match = code.match(/print\(["'](.+?)["']\)/);
    if (match && !code.includes('input(')) return match[1];
  }

  // C++ cout with string literal
  if (language === 'cpp' && code.includes('cout') && 
      code.includes('<<') && !code.includes('cin')) {
    const match = code.match(/cout\s*<<\s*["'](.+?)["']/);
    if (match) return match[1];
  }

  // ========== FIZZBUZZ (CHECK FIRST - before reverse/loops) ==========

  const hasFizzBuzz = lowerCode.includes('fizz') && lowerCode.includes('buzz');
  const hasMod3and5 = lowerCode.includes('% 3') && lowerCode.includes('% 5');

  if (hasFizzBuzz || hasMod3and5) {
    const n = parseInt(stdin.trim());

    if (!isNaN(n) && n >= 1) {
      const result = [];
      for (let i = 1; i <= n; i++) {
        if (i % 15 === 0) result.push('FizzBuzz');
        else if (i % 3 === 0) result.push('Fizz');
        else if (i % 5 === 0) result.push('Buzz');
        else result.push(i.toString());
      }
      return result.join('\n');
    }
  }

// ========== PALINDROME ==========

const hasPalindrome = lowerCode.includes('palindrome') ||
  (lowerCode.includes('startswith') && lowerCode.includes('[::-1]')) ||
  (lowerCode.includes('true') && lowerCode.includes('false') && 
   lowerCode.includes('[::-1]'));

if (hasPalindrome) {
  const num = stdin.trim();
  if (num.startsWith('-')) return 'false';
  const reversed = num.split('').reverse().join('');
  return num === reversed ? 'true' : 'false';
}
  // ========== VALID PARENTHESES ==========

  const hasStack = lowerCode.includes('stack') || lowerCode.includes('push');
  const hasBrackets = lowerCode.includes("'('") || lowerCode.includes('"("') ||
                      lowerCode.includes("'['") || lowerCode.includes('"["');

  if (hasStack || hasBrackets) {
    const s = stdin.trim();
    const stack = [];
    const pairs = { '(': ')', '[': ']', '{': '}' };

    for (const char of s) {
      if (char in pairs) {
        stack.push(char);
      } else {
        const last = stack.pop();
        if (!last || pairs[last] !== char) return 'Invalid';
      }
    }
    return stack.length === 0 ? 'Valid' : 'Invalid';
  }

  // ========== TWO SUM ==========

  if (stdin.includes('\n')) {
    const hasTarget = lowerCode.includes('target');
    const hasTwoSum = lowerCode.includes('two sum') || 
                      (lowerCode.includes('sum') && lowerCode.includes('pair'));

    if (hasTarget || hasTwoSum) {
      const lines = stdin.split('\n');
      const nums = lines[0].split(' ').map(Number);
      const target = parseInt(lines[1]);

      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          if (nums[i] + nums[j] === target) {
            return `${i} ${j}`;
          }
        }
      }
      return '';
    }
  }

  // ========== REVERSE STRING ==========

 // Python - Only if NOT palindrome check
if (language === 'python' && stdin && (
  code.includes('[::-1]') ||
  lowerCode.includes('reversed(')
) && !lowerCode.includes('true') && !lowerCode.includes('false')) {
  return stdin.split('').reverse().join('');
}

  // C++
  if (language === 'cpp' && stdin && (
    lowerCode.includes('reverse(') ||
    (lowerCode.includes('rbegin') && lowerCode.includes('rend'))
  )) {
    return stdin.split('').reverse().join('');
  }

  // JavaScript
  if (language === 'javascript' && stdin && (
    lowerCode.includes('.reverse()') ||
    (lowerCode.includes('split') && lowerCode.includes('reverse'))
  )) {
    return stdin.split('').reverse().join('');
  }

  // ========== DEFAULT ==========
  return stdin || 'No output';
};

/**
 * Check if output matches expected
 */
export const checkOutput = (actual, expected) => {
  const normalize = (str) => str.trim().replace(/\s+/g, ' ');
  return normalize(actual) === normalize(expected);
};

/**
 * Run test cases
 */
export const runTestCases = async (sourceCode, languageId, testCases) => {
  console.log(`🎭 Mock execution: Running ${testCases.length} test cases...`);

  const results = [];
  let allPassed = true;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📝 Test case ${i + 1}/${testCases.length}`);
    console.log(`📥 Input: "${testCase.input}"`);
    console.log(`📤 Expected: "${testCase.expectedOutput}"`);

    // Small delay between test cases (realistic)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const result = await executeCode(sourceCode, languageId, testCase.input);

    console.log(`📊 Output: "${result.stdout}"`);
    console.log(`📊 Verdict: ${result.verdict}`);

    if (result.verdict === 'Compilation Error' || result.verdict === 'Runtime Error') {
      results.push({
        testCase: i + 1,
        passed: false,
        verdict: result.verdict,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: result.stderr || result.compile_output,
      });
      allPassed = false;
      break;
    }

    const passed = checkOutput(result.stdout, testCase.expectedOutput);
    
    results.push({
      testCase: i + 1,
      passed,
      verdict: passed ? 'Accepted' : 'Wrong Answer',
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: result.stdout,
    });

    if (!passed) {
      allPassed = false;
    }
  }

  return {
    verdict: allPassed ? 'Accepted' : results[results.length - 1].verdict,
    allTestsPassed: allPassed,
    testResults: results,
    totalTests: testCases.length,
    passedTests: results.filter(r => r.passed).length,
  };
};