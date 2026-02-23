import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('📁 Current directory:', __dirname);
console.log('📁 Looking for .env at:', join(__dirname, '.env'));

// Load .env
const result = dotenv.config();

if (result.error) {
  console.log('❌ Error loading .env:', result.error);
} else {
  console.log('✅ .env loaded successfully');
  console.log('📦 Parsed variables:', result.parsed);
}

console.log('\n🔍 Testing specific variables:');
console.log('PORT:', process.env.PORT);
console.log('MONGO_URI:', process.env.MONGO_URI);
console.log('PISTON_URL:', process.env.PISTON_URL);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'EXISTS' : 'MISSING');