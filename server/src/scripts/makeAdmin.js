/**
 * Promote a user to admin role.
 *
 * Usage:
 *   node src/scripts/makeAdmin.js <email>
 *
 * Examples:
 *   node src/scripts/makeAdmin.js admin@codeclash.com
 *   node src/scripts/makeAdmin.js john@example.com
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.model.js';

dotenv.config();

const email = process.argv[2];

if (!email) {
  console.error('Usage: node src/scripts/makeAdmin.js <email>');
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/codeclash');
    console.log('✅ Connected to MongoDB');

    const user = await User.findOneAndUpdate(
      { email },
      { $set: { role: 'admin' } },
      { new: true },
    );

    if (!user) {
      console.error(`❌ No user found with email: ${email}`);
      process.exit(1);
    }

    console.log(`✅ User promoted to admin:`);
    console.log(`   Name:  ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role:  ${user.role}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
};

run();
