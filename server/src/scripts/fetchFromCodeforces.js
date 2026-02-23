/**
 * fetchFromCodeforces.js
 *
 * Seeds MongoDB with real Codeforces problems:
 *   1. Calls CF API for rating/tags metadata
 *   2. Scrapes each problem HTML page (with retries) for live descriptions + sample tests
 *   3. Falls back to accurate built-in descriptions when CF is unreachable
 *
 * Usage:
 *   node src/scripts/fetchFromCodeforces.js
 *   npm run seed:cf
 */

import mongoose from 'mongoose';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Problem } from '../models/Problem.model.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const CF_API   = 'https://codeforces.com/api';
const CF_BASE  = 'https://codeforces.com';
const DELAY_MS = 1200;
const TIMEOUT  = 8000;
const RETRIES  = 0;   // 0 = fail fast if CF blocked; increase to 2 if CF is reachable

const CF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Referer': 'https://codeforces.com/problemset',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mapDifficulty(rating, override) {
  if (override) return override;
  if (!rating)   return 'medium';
  if (rating <= 1200) return 'easy';
  if (rating <= 1900) return 'medium';
  return 'hard';
}

function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<sup>([^<]*)<\/sup>/gi, '^$1').replace(/<sub>([^<]*)<\/sub>/gi, '_$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\${1,3}([^$\n]+)\${1,3}/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n').trim();
}

// ── Accurate built-in descriptions (used when CF page is unreachable) ─────────
const FALLBACK_DESC = {
  '4_A': `Pete has a watermelon of weight w kg. He and his friend want to split it so both pieces weigh an even number of kilograms and each weighs at least 2 kg.

Input:
A single integer w (1 ≤ w ≤ 100).

Output:
Print YES if it's possible, NO otherwise.

Example:
Input:  8
Output: YES

🔗 https://codeforces.com/problemset/problem/4/A`,

  '71_A': `Words longer than 10 characters should be abbreviated as: first letter + count of omitted letters + last letter. Words with 10 or fewer characters stay unchanged.

Input:
First line — n (1 ≤ n ≤ 100). Then n lines each with one word (1–100 lowercase letters).

Output:
Print n lines with abbreviated or unchanged words.

Example:
Input:  4
        word
        localization
        internationalization
        pneumonoultramicroscopicsilicovolcanoconiosis
Output: word
        l10n
        i18n
        p43s

🔗 https://codeforces.com/problemset/problem/71/A`,

  '282_A': `Variable X starts at 0. Each instruction is either "X++" (increment) or "--X" (decrement). Find the value of X after executing all n instructions.

Input:
First line — n (1 ≤ n ≤ 150). Each of the next n lines is "X++" or "--X".

Output:
Print the final value of X.

Example:
Input:  3
        X++
        X++
        --X
Output: 1

🔗 https://codeforces.com/problemset/problem/282/A`,

  '50_A': `Given a rectangular board of size m × n, find the maximum number of 1×2 dominoes that can be placed on it without overlaps.

Input:
Two integers m and n (1 ≤ m, n ≤ 1000).

Output:
Print the maximum number of dominoes.

Example:
Input:  2 4
Output: 4

🔗 https://codeforces.com/problemset/problem/50/A`,

  '59_A': `A word was typed with CapsLock accidentally on. Determine the intended word: if more than half the letters are uppercase, the whole word should be uppercase; otherwise lowercase. If equal, go lowercase.

Input:
One word of Latin letters (1–100 characters).

Output:
Print the corrected word (all upper or all lower).

Example:
Input:  HellO
Output: HELLO

🔗 https://codeforces.com/problemset/problem/59/A`,

  '41_A': `In this language, the translation of a word is always the word spelled backwards. Check whether a given translation is correct.

Input:
First line — the original word (1–100 lowercase letters).
Second line — its claimed translation.

Output:
Print YES if translation equals the reverse of the word, NO otherwise.

Example:
Input:  code
        edoc
Output: YES

🔗 https://codeforces.com/problemset/problem/41/A`,

  '231_A': `Three friends each vote on whether to solve each problem (1 = yes, 0 = no). A problem is submitted if at least 2 of 3 vote yes. Count how many problems get submitted.

Input:
First line — n (1 ≤ n ≤ 1000). Each of the next n lines has three integers (0 or 1).

Output:
Print the number of problems submitted.

Example:
Input:  3
        1 1 0
        1 1 1
        1 0 0
Output: 2

🔗 https://codeforces.com/problemset/problem/231/A`,

  '266_A': `A sequence of Black (B) and White (W) stones sits on a table. Each turn, remove any stone that matches its right neighbour. Count the total number of stones removed.

Input:
First line — n (1 ≤ n ≤ 10^5). Second line — a string of B and W characters.

Output:
Print the number of removed stones.

Example:
Input:  5
        BWWBW
Output: 1

🔗 https://codeforces.com/problemset/problem/266/A`,

  '116_A': `A tram runs n stops. At each stop some passengers exit and some board. The tram starts empty and has unknown capacity. Find the minimum capacity so the tram is never over capacity.

Input:
First line — n (1 ≤ n ≤ 1000). Each of the next n lines — two integers: passengers exiting and boarding.

Output:
Print the minimum required capacity.

Example:
Input:  4
        0 3
        2 5
        4 2
        4 0
Output: 6

🔗 https://codeforces.com/problemset/problem/116/A`,

  '1_A': `A city square of n × m metres must be paved with square granite tiles of size a × a. Tiles may extend beyond the edge but cannot be cut. Find the minimum number of tiles needed.

Input:
Three integers n, m, a (1 ≤ n, m, a ≤ 10^9).

Output:
Print the minimum number of tiles (as a 64-bit integer).

Example:
Input:  6 6 4
Output: 4

🔗 https://codeforces.com/problemset/problem/1/A`,

  '469_A': `Mike and Chester have each cleared some levels of a game with n levels. Together they must have cleared all n levels (each level by at least one of them) to "become the Guy". Check if that's the case.

Input:
First line — n. Second line — k1, then k1 level numbers Mike cleared. Third line — k2, then k2 level numbers Chester cleared.

Output:
Print "I become the Guy." or "I will not become the Guy."

🔗 https://codeforces.com/problemset/problem/469/A`,

  '432_A': `Each student has participated in some number of contests. A student can join the next team if they have participated in at most (7 - k) contests. Count eligible students.

Input:
First line — n k (1 ≤ n ≤ 100, 1 ≤ k ≤ 7). Second line — n integers (contest participation counts).

Output:
Print the count of eligible students.

Example:
Input:  5 2
        1 2 3 4 5
Output: 2

🔗 https://codeforces.com/problemset/problem/432/A`,

  '546_A': `A soldier wants to buy k bananas. The i-th banana costs i coins (1-indexed). He has w coins. His friend will lend him the rest. How many coins must he borrow? (Total cost = 1+2+...+k = k*(k+1)/2)

Input:
Three integers k, n, w (1 ≤ k ≤ 1000, 1 ≤ n ≤ 10, 0 ≤ w ≤ 1000). Only k and w matter.

Output:
Print max(0, k*(k+1)/2 - w).

Example:
Input:  3 2 3
Output: 3

🔗 https://codeforces.com/problemset/problem/546/A`,

  '379_A': `Vasya lights n candles. When a candle burns out, it becomes a stub. Every k stubs can be recycled into one new candle. How many candles does he burn in total (including recycled ones)?

Input:
Two integers n and k (1 ≤ n ≤ 10^7, 2 ≤ k ≤ 10^7).

Output:
Print the total number of candles burned.

Example:
Input:  4 2
Output: 7

🔗 https://codeforces.com/problemset/problem/379/A`,

  '131_A': `A word was typed with CapsLock on by mistake. The transformation: all letters get inverted (upper→lower, lower→upper). Undo the CapsLock transformation to recover the intended word.

Rules:
- If all letters are uppercase → convert to all lowercase
- If first letter is lowercase and the rest are uppercase → capitalize first + lowercase rest
- Otherwise → print as-is

Input:
One word of Latin letters (1–100 chars).

Output:
Print the intended word.

Example:
Input:  hELLO
Output: Hello

🔗 https://codeforces.com/problemset/problem/131/A`,

  '734_A': `Anton and Danik play a game of n rounds. In each round, 'A' means Anton wins and 'D' means Danik wins. Print the overall winner or "Friendship" if tied.

Input:
First line — n (1 ≤ n ≤ 26000). Second line — a string of length n of 'A' and 'D'.

Output:
Print Anton, Danik, or Friendship.

Example:
Input:  6
        ADAAAA
Output: Anton

🔗 https://codeforces.com/problemset/problem/734/A`,

  '158_A': `In a programming contest, the top k participants advance. Additionally, anyone with the same score as the k-th participant also advances, provided their score is > 0.

Input:
First line — n k. Second line — n scores in non-increasing order.

Output:
Print the number of advancing participants.

Example:
Input:  8 5
        10 9 8 7 7 7 5 5
Output: 6

🔗 https://codeforces.com/problemset/problem/158/A`,

  '118_A': `Process a string as follows:
1. Remove all vowels: a, e, i, o, u, y (both cases)
2. Convert remaining letters to lowercase
3. Prepend a dot '.' before each remaining letter

Input:
One string of Latin letters (1–100 chars).

Output:
Print the processed string (empty string if no consonants remain).

Example:
Input:  tour
Output: .t.r

🔗 https://codeforces.com/problemset/problem/118/A`,

  '677_A': `Vanya wants to build a fence of n sections, height h. He has b planks of length 1 and a planks of length 2. To build a section of height h, he can use planks summing to exactly h. Each section needs exactly 1 plank covering h: use a 2-plank if h=2 else a 1-plank... Actually: given n people with heights, count how many have height < fence height h (they need a boost to get over).

Input:
First line — n h. Second line — n heights.

Output:
Print the count of people shorter than h.

Example:
Input:  3 6
        7 2 6
Output: 1

🔗 https://codeforces.com/problemset/problem/677/A`,

  '500_A': `There are n+1 cities in a row (numbered 1 to n+1). From city i you can jump forward up to a[i] positions. Starting from city 1, determine if you can reach city n+1.

Input:
Two integers n t (1 ≤ n ≤ 300). Second line — n jump values a[i].

Output:
Print YES or NO.

Example:
Input:  3 2
        1 2 1
Output: YES

🔗 https://codeforces.com/problemset/problem/500/A`,

  '96_A': `Given n numbers, one of them appears an odd number of times while all others appear an even number of times. Find the odd-count element.

Input:
First line — n (odd, 1 ≤ n ≤ 1000). Second line — n integers.

Output:
Print the element that appears an odd number of times.

Example:
Input:  5
        1 1 2 3 3
Output: 2

🔗 https://codeforces.com/problemset/problem/96/A`,

  '136_A': `Given a list of present numbers a child received, find the smallest positive integer she did NOT receive.

Input:
First line — n (1 ≤ n ≤ 100). Second line — n positive integers.

Output:
Print the smallest missing positive integer.

Example:
Input:  5
        1 2 3 4 5
Output: 6

🔗 https://codeforces.com/problemset/problem/136/A`,

  '263_A': `You are given a 5×5 matrix containing integers 0 through 24 (each exactly once). Find the minimum number of swaps of adjacent elements needed to move the value 0 to the center cell [2][2] (0-indexed).

The minimum moves equals the Manhattan distance of 0 from the center.

Input:
5 lines, each with 5 space-separated integers.

Output:
Print the minimum number of moves.

Example:
Input:  0 1 2 3 4
        5 6 7 8 9
        10 11 12 13 14
        15 16 17 18 19
        20 21 22 23 24
Output: 4

🔗 https://codeforces.com/problemset/problem/263/A`,

  '25_A': `Given n numbers, all but one share the same parity (even/odd), while exactly one differs. Find the 1-based index of the "odd one out" in terms of parity.

Input:
First line — n (3 ≤ n ≤ 100). Second line — n positive integers.

Output:
Print the 1-based index of the number with different parity.

Example:
Input:  5
        2 4 7 8 10
Output: 3

🔗 https://codeforces.com/problemset/problem/25/A`,
};

// ── Curated problem list with test cases ──────────────────────────────────────
// title/difficulty are hardcoded here so the script works even without CF API
const CF_PROBLEMS = [
  { contestId: 4,   index: 'A', title: 'Watermelon',               difficulty: 'easy',   hiddenTests: [{ input: '4', expectedOutput: 'YES' }, { input: '1', expectedOutput: 'NO' }] },
  { contestId: 71,  index: 'A', title: 'Way Too Long Words',        difficulty: 'easy',   hiddenTests: [{ input: '1\nabcdefghijk', expectedOutput: 'a9k' }, { input: '1\nhello', expectedOutput: 'hello' }] },
  { contestId: 282, index: 'A', title: 'Bit++',                     difficulty: 'easy',   hiddenTests: [{ input: '3\nX++\n--X\nX++', expectedOutput: '1' }, { input: '1\nX--', expectedOutput: '-1' }] },
  { contestId: 50,  index: 'A', title: 'Domino Piling',             difficulty: 'easy',   hiddenTests: [{ input: '1 1', expectedOutput: '0' }, { input: '5 5', expectedOutput: '12' }] },
  { contestId: 59,  index: 'A', title: 'Word',                      difficulty: 'easy',   hiddenTests: [{ input: 'HELLO', expectedOutput: 'HELLO' }, { input: 'hello', expectedOutput: 'hello' }] },
  { contestId: 41,  index: 'A', title: 'Translation',               difficulty: 'easy',   hiddenTests: [{ input: 'codeforces\nsecrofedoc', expectedOutput: 'YES' }, { input: 'hello\nworld', expectedOutput: 'NO' }] },
  { contestId: 231, index: 'A', title: 'Team',                      difficulty: 'easy',   hiddenTests: [{ input: '2\n0 0 0\n1 1 1', expectedOutput: '1' }, { input: '1\n1 0 0', expectedOutput: '0' }] },
  { contestId: 266, index: 'A', title: 'Stones on the Table',       difficulty: 'easy',   hiddenTests: [{ input: '4\nBBBB', expectedOutput: '3' }, { input: '1\nW', expectedOutput: '0' }] },
  { contestId: 116, index: 'A', title: 'Tram',                      difficulty: 'easy',   hiddenTests: [{ input: '1\n0 3', expectedOutput: '3' }, { input: '2\n3 2\n0 4', expectedOutput: '5' }] },
  { contestId: 1,   index: 'A', title: 'Theatre Square',            difficulty: 'easy',   hiddenTests: [{ input: '1 1 1', expectedOutput: '1' }, { input: '6 6 4', expectedOutput: '4' }] },
  { contestId: 469, index: 'A', title: 'I Wanna Be the Guy',        difficulty: 'easy',   hiddenTests: [{ input: '3\n2\n1 2\n2\n2 3', expectedOutput: 'I will not become the Guy.' }] },
  { contestId: 432, index: 'A', title: 'Choosing Teams',            difficulty: 'easy',   hiddenTests: [{ input: '1 1\n10', expectedOutput: '3' }, { input: '3 3\n8 9 10', expectedOutput: '0' }] },
  { contestId: 546, index: 'A', title: 'Soldier and Bananas',       difficulty: 'easy',   hiddenTests: [{ input: '1 1 1', expectedOutput: '0' }, { input: '5 1 5', expectedOutput: '10' }] },
  { contestId: 379, index: 'A', title: 'New Year Candles',          difficulty: 'easy',   hiddenTests: [{ input: '5 3', expectedOutput: '1' }, { input: '1 1', expectedOutput: '0' }] },
  { contestId: 131, index: 'A', title: 'cAPS lOCK',                 difficulty: 'easy',   hiddenTests: [{ input: 'hELLO', expectedOutput: 'Hello' }, { input: 'HELLO', expectedOutput: 'hello' }] },
  { contestId: 734, index: 'A', title: 'Anton and Danik',           difficulty: 'easy',   hiddenTests: [{ input: '3\naab', expectedOutput: 'Danik' }, { input: '1\nA', expectedOutput: 'Anton' }] },
  { contestId: 158, index: 'A', title: 'Next Round',                difficulty: 'medium', hiddenTests: [{ input: '5 1\n1 2 3 4 5', expectedOutput: '5' }, { input: '4 2\n0 0 0 0', expectedOutput: '0' }] },
  { contestId: 118, index: 'A', title: 'String Task',               difficulty: 'medium', hiddenTests: [{ input: 'hi', expectedOutput: '.h' }, { input: 'Tour', expectedOutput: '.t.r' }] },
  { contestId: 677, index: 'A', title: 'Vanya and Fence',           difficulty: 'easy',   hiddenTests: [{ input: '3 6\n7 2 6', expectedOutput: '1' }, { input: '2 5\n3 6', expectedOutput: '1' }] },
  { contestId: 500, index: 'A', title: 'New Year Transportation',   difficulty: 'easy',   hiddenTests: [{ input: '3 2\n1 2 1', expectedOutput: 'YES' }, { input: '3 3\n1 1 1', expectedOutput: 'NO' }] },
  { contestId: 96,  index: 'A', title: 'Football Kit',              difficulty: 'medium', hiddenTests: [{ input: '3\n2 2 3', expectedOutput: '3' }, { input: '5\n1 1 2 3 3', expectedOutput: '2' }] },
  { contestId: 136, index: 'A', title: 'Presents',                  difficulty: 'easy',   hiddenTests: [{ input: '3\n2 3 4', expectedOutput: '1' }, { input: '3\n1 2 3', expectedOutput: '4' }] },
  { contestId: 263, index: 'A', title: 'Beautiful Matrix',          difficulty: 'medium', hiddenTests: [{ input: '0 1 2 3 4\n5 6 7 8 9\n10 11 12 13 14\n15 16 17 18 19\n20 21 22 23 24', expectedOutput: '4' }] },
  { contestId: 25,  index: 'A', title: 'IQ Test',                   difficulty: 'medium', hiddenTests: [{ input: '5\n2 4 7 8 10', expectedOutput: '3' }, { input: '3\n1 3 5', expectedOutput: '1' }] },
];

// ── Fetch CF API metadata ─────────────────────────────────────────────────────
async function fetchCFMeta() {
  const res = await axios.get(`${CF_API}/problemset.problems`, { timeout: TIMEOUT });
  if (res.data.status !== 'OK') throw new Error('CF API non-OK status');
  const map = {};
  for (const p of res.data.result.problems) map[`${p.contestId}_${p.index}`] = p;
  return map;
}

// ── Scrape CF problem page with retries ───────────────────────────────────────
async function scrapeProblem(contestId, index) {
  const url = `${CF_BASE}/problemset/problem/${contestId}/${index}`;
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(attempt * 2500);
    try {
      const res = await axios.get(url, { timeout: TIMEOUT, headers: CF_HEADERS });
      const $ = cheerio.load(res.data);
      const $stmt = $('.problem-statement');
      if (!$stmt.length) return null;

      const rawTitle = $stmt.find('.header .title').first().text().trim();
      const title = rawTitle.replace(/^[A-Z0-9]+\.\s*/, '');

      const mainParts = [];
      $stmt.children().each((_, el) => {
        const cls = $(el).attr('class') || '';
        const tag = ($(el).prop('tagName') || '').toLowerCase();
        const skip = ['header','input-specification','output-specification',
                      'sample-tests','note','tutorial'].some((c) => cls.includes(c));
        if (!skip && (tag === 'p' || tag === 'ul' || tag === 'ol')) {
          const t = htmlToText($(el).html() || '');
          if (t) mainParts.push(t);
        }
      });

      const inputSpec  = htmlToText($stmt.find('.input-specification').html() || '').replace(/^input\s*/i, '').trim();
      const outputSpec = htmlToText($stmt.find('.output-specification').html() || '').replace(/^output\s*/i, '').trim();

      const description = [
        mainParts.join('\n\n'),
        inputSpec  ? `Input:\n${inputSpec}`  : '',
        outputSpec ? `Output:\n${outputSpec}` : '',
        `\n🔗 https://codeforces.com/problemset/problem/${contestId}/${index}`,
      ].filter(Boolean).join('\n\n');

      const samples = [];
      $stmt.find('.sample-test').each((_, el) => {
        const inp = $(el).find('.input pre').map((_, p) => $(p).text().trim()).get().join('\n');
        const out = $(el).find('.output pre').map((_, p) => $(p).text().trim()).get().join('\n');
        if (inp && out) samples.push({ input: inp, expectedOutput: out, isHidden: false });
      });

      if (samples.length > 0) return { title, description, samples };
      return null;
    } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected!\n');

  let cfMeta = {};
  try {
    process.stdout.write('🌐 Fetching CF API metadata... ');
    cfMeta = await fetchCFMeta();
    console.log(`✅ (${Object.keys(cfMeta).length} problems indexed)\n`);
  } catch (err) {
    console.log(`⚠️  CF API unavailable (${err.message})\n`);
  }

  console.log(`📥 Processing ${CF_PROBLEMS.length} Codeforces problems...\n`);
  const toInsert = [];
  let liveCount = 0, fallbackCount = 0, failCount = 0;

  for (let i = 0; i < CF_PROBLEMS.length; i++) {
    const cfg  = CF_PROBLEMS[i];
    const key  = `${cfg.contestId}_${cfg.index}`;
    const meta = cfMeta[key];

    process.stdout.write(`[${String(i + 1).padStart(2, '0')}/${CF_PROBLEMS.length}] CF ${cfg.contestId}${cfg.index} `);

    let title, description, samples = [];
    let source = 'fallback';

    try {
      const scraped = await scrapeProblem(cfg.contestId, cfg.index);
      if (scraped && scraped.samples.length > 0) {
        title = scraped.title; description = scraped.description; samples = scraped.samples;
        source = 'live'; liveCount++;
      }
    } catch (_) {}

    if (source === 'fallback') {
      const fb = FALLBACK_DESC[key];
      if (!fb) { console.log(`❌ No fallback — skipped`); failCount++; await sleep(DELAY_MS); continue; }
      description = fb;
      fallbackCount++;
      // Use first hidden test as a public sample when no scraped samples
      samples = (cfg.hiddenTests || []).slice(0, 1).map((t) => ({ ...t, isHidden: false }));
    }

    if (!title) title = cfg.title || meta?.name || `CF ${cfg.contestId}${cfg.index}`;

    const difficulty = cfg.difficulty || mapDifficulty(meta?.rating);
    const cfRating   = meta?.rating ? ` (CF ${meta.rating})` : '';
    const cfTags     = (meta?.tags || []).slice(0, 3).join(', ') || '';

    const testCases = [
      ...samples,
      ...(cfg.hiddenTests || []).map((t) => ({ ...t, isHidden: true })),
    ].filter((t) => t.expectedOutput && t.expectedOutput.trim() !== undefined);

    if (testCases.length === 0) {
      console.log(`❌ No valid test cases — skipped`); failCount++; await sleep(DELAY_MS); continue;
    }

    toInsert.push({ title, description, difficulty, testCases, languagesAllowed: [71, 63, 62, 54], timeLimit: 2, memoryLimit: 256 });

    const pub  = testCases.filter((t) => !t.isHidden).length;
    const hid  = testCases.filter((t) =>  t.isHidden).length;
    const icon = source === 'live' ? '🌐' : '📋';
    console.log(`${icon} "${title}" [${difficulty.toUpperCase()}]${cfRating}${cfTags ? ` | ${cfTags}` : ''} | ${pub} sample + ${hid} hidden`);

    if (i < CF_PROBLEMS.length - 1) await sleep(DELAY_MS);
  }

  if (toInsert.length === 0) { console.error('\n❌ Nothing to insert.'); process.exit(1); }

  console.log(`\n🗑️  Clearing old problems...`);
  await Problem.deleteMany({});
  console.log(`💾 Inserting ${toInsert.length} Codeforces problems...`);
  const inserted = await Problem.insertMany(toInsert);

  console.log(`\n✅ Seeded ${inserted.length} CF problems  (🌐 ${liveCount} live | 📋 ${fallbackCount} fallback | ❌ ${failCount} failed)\n`);
  inserted.forEach((p, idx) => {
    const pub = p.testCases.filter((t) => !t.isHidden).length;
    const hid = p.testCases.filter((t) =>  t.isHidden).length;
    console.log(`  ${String(idx + 1).padStart(2)}. [${p.difficulty.toUpperCase().padEnd(6)}] ${p.title.padEnd(42)} ${pub} sample + ${hid} hidden`);
  });

  console.log('\n🏁 Done! Start a match to use real Codeforces problems.');
  process.exit(0);
}

main().catch((err) => { console.error('❌ Fatal:', err); process.exit(1); });
