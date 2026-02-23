import dotenv from 'dotenv';
import axios from 'axios';

// Load .env before accessing process.env
dotenv.config();

// Debug: Check if env var is loaded
console.log('🔍 DEBUG - process.env.PISTON_URL:', process.env.PISTON_URL);

// Use environment variable with fallback
const PISTON_BASE_URL = process.env.PISTON_URL || 'http://localhost:2000';

console.log('🔍 DEBUG - PISTON_BASE_URL after fallback:', PISTON_BASE_URL);

const PISTON_API_URL = `${PISTON_BASE_URL}/api/v2/piston`;

console.log('🔍 DEBUG - Final PISTON_API_URL:', PISTON_API_URL);

export const mapLanguageIdToPiston = (languageId) => {
  const mapping = {
    63: 'javascript',
    71: 'python',
    62: 'java',
    54: 'c++',
    50: 'c',
    51: 'csharp',
  };
  return mapping[languageId] || 'python';
};

export const pistonApi = axios.create({
  baseURL: PISTON_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

console.log(`🌐 Piston configured: ${PISTON_API_URL}`);