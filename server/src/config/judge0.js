import dotenv from 'dotenv';
dotenv.config();

/**
 * Judge0 Configuration
 *
 * Required .env variables:
 *   JUDGE0_API_URL   — Base URL of the Judge0 instance
 *                      RapidAPI hosted: https://judge0-ce.p.rapidapi.com
 *                      Self-hosted:     http://localhost:2358
 *
 *   JUDGE0_API_KEY   — RapidAPI key (leave empty for self-hosted)
 *   JUDGE0_API_HOST  — RapidAPI host header (only needed for RapidAPI)
 *
 * Free self-hosted setup (Docker):
 *   docker run -d -p 2358:2358 judge0/judge0
 *   Then set JUDGE0_API_URL=http://localhost:2358
 *
 * RapidAPI free tier:
 *   Sign up at https://rapidapi.com/judge0-official/api/judge0-ce
 *   Set JUDGE0_API_KEY=<your-key>
 *   Set JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
 */
export const JUDGE0_CONFIG = {
  apiUrl:  process.env.JUDGE0_API_URL  || 'https://judge0-ce.p.rapidapi.com',
  apiKey:  process.env.JUDGE0_API_KEY  || '',
  apiHost: process.env.JUDGE0_API_HOST || 'judge0-ce.p.rapidapi.com',
  timeout: parseInt(process.env.JUDGE0_TIMEOUT || '30000'),
};

const isSelfHosted = !JUDGE0_CONFIG.apiKey &&
  JUDGE0_CONFIG.apiUrl !== 'https://judge0-ce.p.rapidapi.com';

const isFullyConfigured = !!JUDGE0_CONFIG.apiKey || isSelfHosted;

if (isFullyConfigured) {
  console.log(`✅ Judge0 configured → ${JUDGE0_CONFIG.apiUrl}`);
} else {
  console.warn(
    '⚠️  Judge0: No API key found. Set JUDGE0_API_KEY (RapidAPI) or ' +
    'JUDGE0_API_URL (self-hosted) in .env to enable real code execution.'
  );
}

export const judge0IsConfigured = isFullyConfigured;
export default JUDGE0_CONFIG;
