import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Problem } from '../models/Problem.model.js';

dotenv.config();

const sampleProblems = [
  {
    title: 'Two Sum',
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Example:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].`,
    difficulty: 'easy',
    testCases: [
      {
        input: '2 7 11 15\n9',
        expectedOutput: '0 1',
        isHidden: false,
      },
      {
        input: '3 2 4\n6',
        expectedOutput: '1 2',
        isHidden: false,
      },
      {
        input: '3 3\n6',
        expectedOutput: '0 1',
        isHidden: true,
      },
    ],
    languagesAllowed: [71, 63, 62, 54], // Python, JS, Java, C++
    timeLimit: 2,
    memoryLimit: 256,
  },
  {
    title: 'Reverse String',
    description: `Write a function that reverses a string. The input string is given as an array of characters.

You must do this by modifying the input array in-place with O(1) extra memory.

Example:
Input: ["h","e","l","l","o"]
Output: ["o","l","l","e","h"]`,
    difficulty: 'easy',
    testCases: [
      {
        input: 'hello',
        expectedOutput: 'olleh',
        isHidden: false,
      },
      {
        input: 'world',
        expectedOutput: 'dlrow',
        isHidden: false,
      },
      {
        input: 'a',
        expectedOutput: 'a',
        isHidden: true,
      },
    ],
    languagesAllowed: [71, 63, 62, 54],
    timeLimit: 2,
    memoryLimit: 256,
  },
  {
    title: 'FizzBuzz',
    description: `Given an integer n, return a string array answer (1-indexed) where:
- answer[i] == "FizzBuzz" if i is divisible by 3 and 5.
- answer[i] == "Fizz" if i is divisible by 3.
- answer[i] == "Buzz" if i is divisible by 5.
- answer[i] == i (as a string) if none of the above conditions are true.

Example:
Input: n = 5
Output: ["1","2","Fizz","4","Buzz"]`,
    difficulty: 'easy',
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
    languagesAllowed: [71, 63, 62, 54],
    timeLimit: 2,
    memoryLimit: 256,
  },
  {
    title: 'Palindrome Number',
    description: `Given an integer x, return true if x is a palindrome, and false otherwise.

Example:
Input: x = 121
Output: true
Explanation: 121 reads as 121 from left to right and from right to left.`,
    difficulty: 'easy',
    testCases: [
      {
        input: '121',
        expectedOutput: 'true',
        isHidden: false,
      },
      {
        input: '-121',
        expectedOutput: 'false',
        isHidden: false,
      },
      {
        input: '10',
        expectedOutput: 'false',
        isHidden: true,
      },
    ],
    languagesAllowed: [71, 63, 62, 54],
    timeLimit: 2,
    memoryLimit: 256,
  },
{
  title: 'Valid Parentheses',
  description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.

Print "Valid" if valid, "Invalid" if not valid.

Example:
Input: ()
Output: Valid

Input: (]
Output: Invalid`,
  difficulty: 'medium',
testCases: [
  {
    input: '()',
    expectedOutput: 'Valid',  // ← FIXED
    isHidden: false,
  },
  {
    input: '()[]{}',
    expectedOutput: 'Valid',  // ← FIXED
    isHidden: false,
  },
  {
    input: '(]',
    expectedOutput: 'Invalid', // ← FIXED
    isHidden: true,
  },
],
  languagesAllowed: [71, 63, 62, 54],
  timeLimit: 2,
  memoryLimit: 256,
},
];

const seedProblems = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing problems
    await Problem.deleteMany({});
    console.log('🗑️  Cleared existing problems');

    // Insert sample problems
    const problems = await Problem.insertMany(sampleProblems);
    console.log(`✅ Seeded ${problems.length} problems`);

    problems.forEach((p) => {
      console.log(`   - ${p.title} (${p.difficulty})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding problems:', error);
    process.exit(1);
  }
};

seedProblems();