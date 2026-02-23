/**
 * fetchAndSeedProblems.js
 *
 * Fetches real problem descriptions from the alfa-leetcode-api (free public API),
 * pairs them with predefined test cases, and seeds the MongoDB database.
 *
 * Usage:
 *   node src/scripts/fetchAndSeedProblems.js
 */

import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Problem } from '../models/Problem.model.js';

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = 'https://alfa-leetcode-api.onrender.com';
const FETCH_TIMEOUT = 4000;  // 4s fast-fail (Render free tier may be asleep)
const DELAY_MS = 300;        // Short delay between API calls

// ── HTML Stripper ────────────────────────────────────────────────────────────
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/pre>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Problems Config ──────────────────────────────────────────────────────────
// Each entry: slug (LeetCode title slug), difficulty, testCases
// Descriptions are fetched live from alfa-leetcode-api; test cases are predefined.
const PROBLEMS_CONFIG = [
  {
    slug: 'two-sum',
    difficulty: 'easy',
    fallbackDescription: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
You may assume that each input has exactly one solution, and you may not use the same element twice.

Input format: space-separated integers on line 1, target on line 2.

Example:
Input: 2 7 11 15
       9
Output: 0 1`,
    testCases: [
      { input: '2 7 11 15\n9',  expectedOutput: '0 1', isHidden: false },
      { input: '3 2 4\n6',      expectedOutput: '1 2', isHidden: false },
      { input: '3 3\n6',        expectedOutput: '0 1', isHidden: true  },
      { input: '1 5 3 2 4\n6',  expectedOutput: '1 4', isHidden: true  },
    ],
  },
  {
    slug: 'palindrome-number',
    difficulty: 'easy',
    fallbackDescription: `Given an integer x, return true if x is a palindrome, and false otherwise.

Example:
Input: 121
Output: true

Input: -121
Output: false`,
    testCases: [
      { input: '121',   expectedOutput: 'true',  isHidden: false },
      { input: '-121',  expectedOutput: 'false', isHidden: false },
      { input: '10',    expectedOutput: 'false', isHidden: true  },
      { input: '12321', expectedOutput: 'true',  isHidden: true  },
    ],
  },
  {
    slug: 'reverse-string',
    difficulty: 'easy',
    fallbackDescription: `Write a function that reverses a string. The input is given as a single word.

Example:
Input: hello
Output: olleh`,
    testCases: [
      { input: 'hello',  expectedOutput: 'olleh',  isHidden: false },
      { input: 'world',  expectedOutput: 'dlrow',  isHidden: false },
      { input: 'a',      expectedOutput: 'a',      isHidden: true  },
      { input: 'abcde',  expectedOutput: 'edcba',  isHidden: true  },
    ],
  },
  {
    slug: 'fizz-buzz',
    difficulty: 'easy',
    fallbackDescription: `Given an integer n, print numbers from 1 to n (one per line), replacing multiples of 3 with "Fizz", multiples of 5 with "Buzz", and multiples of both with "FizzBuzz".

Example:
Input: 5
Output:
1
2
Fizz
4
Buzz`,
    testCases: [
      {
        input: '5',
        expectedOutput: '1\n2\nFizz\n4\nBuzz',
        isHidden: false,
      },
      {
        input: '15',
        expectedOutput: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz',
        isHidden: false,
      },
      {
        input: '3',
        expectedOutput: '1\n2\nFizz',
        isHidden: true,
      },
    ],
  },
  {
    slug: 'valid-parentheses',
    difficulty: 'medium',
    fallbackDescription: `Given a string s containing just '(', ')', '{', '}', '[' and ']', determine if the input string is valid.
Print "Valid" if valid, "Invalid" otherwise.

A string is valid if:
- Open brackets must be closed by the same type of brackets.
- Open brackets must be closed in the correct order.

Example:
Input: ()[]{}
Output: Valid

Input: (]
Output: Invalid`,
    testCases: [
      { input: '()',     expectedOutput: 'Valid',   isHidden: false },
      { input: '()[]{}', expectedOutput: 'Valid',   isHidden: false },
      { input: '(]',     expectedOutput: 'Invalid', isHidden: false },
      { input: '([)]',   expectedOutput: 'Invalid', isHidden: true  },
      { input: '{[]}',   expectedOutput: 'Valid',   isHidden: true  },
    ],
  },
  {
    slug: 'maximum-subarray',
    difficulty: 'medium',
    fallbackDescription: `Given an integer array nums, find the subarray with the largest sum, and return its sum.

Input format: space-separated integers.

Example:
Input: -2 1 -3 4 -1 2 1 -5 4
Output: 6
Explanation: The subarray [4,-1,2,1] has the largest sum 6.`,
    testCases: [
      { input: '-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6',  isHidden: false },
      { input: '1',                      expectedOutput: '1',  isHidden: false },
      { input: '5 4 -1 7 8',            expectedOutput: '23', isHidden: true  },
      { input: '-1 -2 -3 -4',           expectedOutput: '-1', isHidden: true  },
    ],
  },
  {
    slug: 'climbing-stairs',
    difficulty: 'easy',
    fallbackDescription: `You are climbing a staircase. It takes n steps to reach the top.
Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?

Example:
Input: 2
Output: 2
Explanation: 1+1 or 2

Input: 3
Output: 3
Explanation: 1+1+1, 1+2, 2+1`,
    testCases: [
      { input: '2',  expectedOutput: '2',  isHidden: false },
      { input: '3',  expectedOutput: '3',  isHidden: false },
      { input: '5',  expectedOutput: '8',  isHidden: true  },
      { input: '10', expectedOutput: '89', isHidden: true  },
    ],
  },
  {
    slug: 'best-time-to-buy-and-sell-stock',
    difficulty: 'easy',
    fallbackDescription: `You are given an array prices where prices[i] is the price of a stock on the i-th day.
You want to maximize your profit by choosing a single day to buy and a single day to sell (after buy day).
Return the maximum profit. If no profit is possible, return 0.

Input format: space-separated prices.

Example:
Input: 7 1 5 3 6 4
Output: 5
Explanation: Buy on day 2 (price=1), sell on day 5 (price=6).`,
    testCases: [
      { input: '7 1 5 3 6 4', expectedOutput: '5', isHidden: false },
      { input: '7 6 4 3 1',   expectedOutput: '0', isHidden: false },
      { input: '1 2',         expectedOutput: '1', isHidden: true  },
      { input: '2 4 1 7',     expectedOutput: '6', isHidden: true  },
    ],
  },
  {
    slug: 'single-number',
    difficulty: 'easy',
    fallbackDescription: `Given a non-empty array of integers nums, every element appears twice except for one. Find that single one.

Input format: space-separated integers.

Example:
Input: 2 2 1
Output: 1

Input: 4 1 2 1 2
Output: 4`,
    testCases: [
      { input: '2 2 1',       expectedOutput: '1', isHidden: false },
      { input: '4 1 2 1 2',   expectedOutput: '4', isHidden: false },
      { input: '1',           expectedOutput: '1', isHidden: true  },
      { input: '0 1 0 5 5 6 6', expectedOutput: '1', isHidden: true },
    ],
  },
  {
    slug: 'contains-duplicate',
    difficulty: 'easy',
    fallbackDescription: `Given an integer array nums, return true if any value appears at least twice in the array, and false if every element is distinct.

Input format: space-separated integers.

Example:
Input: 1 2 3 1
Output: true

Input: 1 2 3 4
Output: false`,
    testCases: [
      { input: '1 2 3 1',   expectedOutput: 'true',  isHidden: false },
      { input: '1 2 3 4',   expectedOutput: 'false', isHidden: false },
      { input: '1 1 1 3 3 4 3 2 4 2', expectedOutput: 'true', isHidden: true },
    ],
  },
  {
    slug: 'roman-to-integer',
    difficulty: 'easy',
    fallbackDescription: `Given a roman numeral string, convert it to an integer.

Symbols: I=1, V=5, X=10, L=50, C=100, D=500, M=1000
Subtractive notation: IV=4, IX=9, XL=40, XC=90, CD=400, CM=900.

Example:
Input: III
Output: 3

Input: LVIII
Output: 58`,
    testCases: [
      { input: 'III',     expectedOutput: '3',    isHidden: false },
      { input: 'LVIII',   expectedOutput: '58',   isHidden: false },
      { input: 'MCMXCIV', expectedOutput: '1994', isHidden: true  },
      { input: 'IV',      expectedOutput: '4',    isHidden: true  },
    ],
  },
  {
    slug: 'longest-common-prefix',
    difficulty: 'easy',
    fallbackDescription: `Write a function to find the longest common prefix string amongst an array of strings.
If there is no common prefix, print "NONE".

Input format: space-separated words on one line.

Example:
Input: flower flow flight
Output: fl

Input: dog racecar car
Output: NONE`,
    testCases: [
      { input: 'flower flow flight',        expectedOutput: 'fl',    isHidden: false },
      { input: 'dog racecar car',           expectedOutput: 'NONE',  isHidden: false },
      { input: 'ab a',                      expectedOutput: 'a',     isHidden: true  },
      { input: 'interview inter internal',  expectedOutput: 'inter', isHidden: true  },
    ],
  },
  {
    slug: 'merge-sorted-array',
    difficulty: 'medium',
    fallbackDescription: `You are given two integer arrays nums1 and nums2, sorted in non-decreasing order, and integers m and n.
Merge nums2 into nums1 in-place so that nums1 is sorted.

Input format:
Line 1: elements of nums1 (m + n values, last n are zeros)
Line 2: m (count of real elements in nums1)
Line 3: elements of nums2
Line 4: n (count of elements in nums2)

Output: merged sorted array, space-separated.

Example:
Input: 1 2 3 0 0 0
       3
       2 5 6
       3
Output: 1 2 2 3 5 6`,
    testCases: [
      {
        input: '1 2 3 0 0 0\n3\n2 5 6\n3',
        expectedOutput: '1 2 2 3 5 6',
        isHidden: false,
      },
      {
        input: '1\n1\n\n0',
        expectedOutput: '1',
        isHidden: false,
      },
      {
        input: '0\n0\n1\n1',
        expectedOutput: '1',
        isHidden: true,
      },
      {
        input: '4 5 6 0 0 0\n3\n1 2 3\n3',
        expectedOutput: '1 2 3 4 5 6',
        isHidden: true,
      },
    ],
  },
  {
    slug: 'move-zeroes',
    difficulty: 'easy',
    fallbackDescription: `Given an integer array nums, move all 0s to the end of the array while maintaining the relative order of non-zero elements.

Input format: space-separated integers.

Example:
Input: 0 1 0 3 12
Output: 1 3 12 0 0`,
    testCases: [
      { input: '0 1 0 3 12', expectedOutput: '1 3 12 0 0', isHidden: false },
      { input: '0',          expectedOutput: '0',          isHidden: false },
      { input: '1 0 0 0 2 3', expectedOutput: '1 2 3 0 0 0', isHidden: true },
    ],
  },
  {
    slug: 'binary-search',
    difficulty: 'easy',
    fallbackDescription: `Given an array of integers nums sorted in ascending order and an integer target, write a function to search target in nums.
Return the index if found; otherwise return -1.

Input format: space-separated sorted integers on line 1, target on line 2.

Example:
Input: -1 0 3 5 9 12
       9
Output: 4`,
    testCases: [
      { input: '-1 0 3 5 9 12\n9',   expectedOutput: '4',  isHidden: false },
      { input: '-1 0 3 5 9 12\n2',   expectedOutput: '-1', isHidden: false },
      { input: '5\n5',               expectedOutput: '0',  isHidden: true  },
      { input: '1 3 5 7 9 11\n7',    expectedOutput: '3',  isHidden: true  },
    ],
  },
  {
    slug: 'count-vowels',
    difficulty: 'easy',
    fallbackDescription: `Given a string, count and print the number of vowels (a, e, i, o, u — both upper and lower case).

Example:
Input: Hello World
Output: 3`,
    testCases: [
      { input: 'Hello World',       expectedOutput: '3', isHidden: false },
      { input: 'aeiou',             expectedOutput: '5', isHidden: false },
      { input: 'rhythm',            expectedOutput: '0', isHidden: true  },
      { input: 'Programming',       expectedOutput: '3', isHidden: true  },
    ],
  },
  {
    slug: 'sum-of-digits',
    difficulty: 'easy',
    fallbackDescription: `Given a non-negative integer n, print the sum of its digits.

Example:
Input: 123
Output: 6

Input: 9999
Output: 36`,
    testCases: [
      { input: '123',  expectedOutput: '6',  isHidden: false },
      { input: '0',    expectedOutput: '0',  isHidden: false },
      { input: '9999', expectedOutput: '36', isHidden: true  },
      { input: '1001', expectedOutput: '2',  isHidden: true  },
    ],
  },
  {
    slug: 'power-of-two',
    difficulty: 'easy',
    fallbackDescription: `Given an integer n, return true if it is a power of two, otherwise return false.
An integer n is a power of two if there exists an integer x such that n == 2^x.

Example:
Input: 1
Output: true

Input: 3
Output: false`,
    testCases: [
      { input: '1',   expectedOutput: 'true',  isHidden: false },
      { input: '16',  expectedOutput: 'true',  isHidden: false },
      { input: '3',   expectedOutput: 'false', isHidden: true  },
      { input: '1024',expectedOutput: 'true',  isHidden: true  },
    ],
  },
  {
    slug: 'missing-number',
    difficulty: 'easy',
    fallbackDescription: `Given an array nums containing n distinct numbers in the range [0, n], return the only number in the range that is missing from the array.

Input format: space-separated integers.

Example:
Input: 3 0 1
Output: 2

Input: 9 6 4 2 3 5 7 0 1
Output: 8`,
    testCases: [
      { input: '3 0 1',             expectedOutput: '2', isHidden: false },
      { input: '0 1',               expectedOutput: '2', isHidden: false },
      { input: '9 6 4 2 3 5 7 0 1', expectedOutput: '8', isHidden: true  },
      { input: '0',                  expectedOutput: '1', isHidden: true  },
    ],
  },
  {
    slug: 'count-primes',
    difficulty: 'medium',
    fallbackDescription: `Given an integer n, return the number of prime numbers strictly less than n.

Example:
Input: 10
Output: 4
Explanation: 2, 3, 5, 7 are prime numbers less than 10.

Input: 0
Output: 0`,
    testCases: [
      { input: '10',  expectedOutput: '4',   isHidden: false },
      { input: '0',   expectedOutput: '0',   isHidden: false },
      { input: '1',   expectedOutput: '0',   isHidden: true  },
      { input: '100', expectedOutput: '25',  isHidden: true  },
    ],
  },
  {
    slug: 'majority-element',
    difficulty: 'easy',
    fallbackDescription: `Given an array nums of size n, return the majority element.
The majority element is the element that appears more than n/2 times. It is guaranteed to always exist.

Input format: space-separated integers.

Example:
Input: 3 2 3
Output: 3

Input: 2 2 1 1 1 2 2
Output: 2`,
    testCases: [
      { input: '3 2 3',           expectedOutput: '3', isHidden: false },
      { input: '2 2 1 1 1 2 2',   expectedOutput: '2', isHidden: false },
      { input: '1',               expectedOutput: '1', isHidden: true  },
      { input: '6 6 6 1 2 6 3 6', expectedOutput: '6', isHidden: true  },
    ],
  },
  {
    slug: 'reverse-integer',
    difficulty: 'medium',
    fallbackDescription: `Given a signed 32-bit integer x, return x with its digits reversed.
If reversing causes overflow (outside [-2^31, 2^31-1]), return 0.

Example:
Input: 123
Output: 321

Input: -120
Output: -21`,
    testCases: [
      { input: '123',   expectedOutput: '321',  isHidden: false },
      { input: '-123',  expectedOutput: '-321', isHidden: false },
      { input: '120',   expectedOutput: '21',   isHidden: true  },
      { input: '1534236469', expectedOutput: '0', isHidden: true },
    ],
  },
  {
    slug: 'counting-bits',
    difficulty: 'easy',
    fallbackDescription: `Given an integer n, for every integer i in the range [0, n], count the number of 1s in the binary representation.
Print all counts space-separated on one line.

Example:
Input: 2
Output: 0 1 1

Input: 5
Output: 0 1 1 2 1 2`,
    testCases: [
      { input: '2', expectedOutput: '0 1 1',       isHidden: false },
      { input: '5', expectedOutput: '0 1 1 2 1 2', isHidden: false },
      { input: '0', expectedOutput: '0',            isHidden: true  },
      { input: '8', expectedOutput: '0 1 1 2 1 2 2 3 1', isHidden: true },
    ],
  },
  {
    slug: 'intersection-of-two-arrays',
    difficulty: 'easy',
    fallbackDescription: `Given two integer arrays nums1 and nums2, return their intersection (unique common elements) sorted in ascending order.
If there is no intersection, print NONE.

Input format: elements of nums1 on line 1, elements of nums2 on line 2 (space-separated).

Example:
Input: 1 2 2 1
       2 2
Output: 2

Input: 4 9 5
       9 4 9 8 4
Output: 4 9`,
    testCases: [
      { input: '1 2 2 1\n2 2',     expectedOutput: '2',   isHidden: false },
      { input: '4 9 5\n9 4 9 8 4', expectedOutput: '4 9', isHidden: false },
      { input: '1 2 3\n4 5 6',     expectedOutput: 'NONE', isHidden: true  },
      { input: '1 2 3\n2 3 4',     expectedOutput: '2 3', isHidden: true  },
    ],
  },
];

// ── Fetch description from alfa-leetcode-api ──────────────────────────────────
async function fetchDescription(slug) {
  try {
    const res = await axios.get(`${API_BASE}/select`, {
      params: { titleSlug: slug },
      timeout: FETCH_TIMEOUT,
    });
    const q = res.data;
    // The API may return { question: {...} } or the object directly
    const question = q.question || q;
    if (question?.content) {
      return stripHtml(question.content);
    }
    return null;
  } catch (err) {
    console.warn(`   ⚠️  Could not fetch description for "${slug}": ${err.message}`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected!\n');

  console.log(`🌐 Fetching ${PROBLEMS_CONFIG.length} problem descriptions from alfa-leetcode-api...\n`);

  const problems = [];

  for (let i = 0; i < PROBLEMS_CONFIG.length; i++) {
    const cfg = PROBLEMS_CONFIG[i];
    console.log(`[${i + 1}/${PROBLEMS_CONFIG.length}] Fetching "${cfg.slug}"...`);

    const fetchedDesc = await fetchDescription(cfg.slug);
    const description = fetchedDesc || cfg.fallbackDescription;

    if (fetchedDesc) {
      console.log(`   ✅ Got description from API (${fetchedDesc.length} chars)`);
    } else {
      console.log(`   📋 Using fallback description`);
    }

    // Build a human-readable title from slug
    const titleFromSlug = cfg.slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    problems.push({
      title: titleFromSlug,
      description,
      difficulty: cfg.difficulty,
      testCases: cfg.testCases,
      languagesAllowed: [71, 63, 62, 54], // Python, JS, Java, C++
      timeLimit: 2,
      memoryLimit: 256,
    });

    // Polite delay between API calls (skip after last)
    if (i < PROBLEMS_CONFIG.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n🗑️  Clearing existing problems...');
  await Problem.deleteMany({});

  console.log('💾 Seeding problems into MongoDB...\n');
  const inserted = await Problem.insertMany(problems);

  console.log(`\n✅ Successfully seeded ${inserted.length} problems:\n`);
  inserted.forEach((p, i) => {
    const testCount = p.testCases.length;
    const hidden = p.testCases.filter((t) => t.isHidden).length;
    console.log(
      `   ${i + 1}. [${p.difficulty.toUpperCase().padEnd(6)}] ${p.title.padEnd(36)} (${testCount} tests, ${hidden} hidden)`
    );
  });

  console.log('\n🎉 Done! Run your server and start a match to use the new problems.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
