import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { User } from '../models/User.model.js';
import { getRedisClient } from '../config/redis.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const OTP_TTL_SEC = 300;       // 5 min
const OTP_RATE_LIMIT_SEC = 60; // 1 request per email per 60s
const OTP_PREFIX = 'otp:gmail:';
const OTP_SENT_PREFIX = 'otp:gmail:sent:';

// ─────────────────────────────────────────────
//  Google OAuth helpers
// ─────────────────────────────────────────────

/**
 * Verify Google ID token and get user info
 */
export const verifyGoogleToken = async (token) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (error) {
    throw new Error('Invalid Google token');
  }
};

/**
 * Verify Google access token by fetching user info from Google API
 */
export const verifyGoogleAccessToken = async (accessToken) => {
  try {
    const res = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error('Invalid access token');
    const payload = await res.json();
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (error) {
    throw new Error('Invalid Google access token');
  }
};

/**
 * Find or create user from Google login
 */
export const findOrCreateUser = async (googleUser) => {
  // First try to find by googleId
  let user = await User.findOne({ googleId: googleUser.googleId });

  if (!user) {
    // Check if an email-registered user exists with same email
    user = await User.findOne({ email: googleUser.email });
    if (user) {
      // Link Google account to existing email user
      user.googleId = googleUser.googleId;
      user.picture = googleUser.picture || user.picture;
      await user.save();
    } else {
      // Brand new user
      user = await User.create({
        googleId: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      });
    }
  } else {
    // Update existing Google user
    user.name = googleUser.name;
    user.picture = googleUser.picture;
    await user.save();
  }

  return user;
};

// ─────────────────────────────────────────────
//  Email / Password helpers
// ─────────────────────────────────────────────

/**
 * Register a new user with email + password
 */
export const registerWithEmail = async ({ name, email, password, role }) => {
  if (role === 'admin' && email !== process.env.ADMIN_EMAIL) {
    throw new Error('You are not authorized to register as an admin');
  }

  // Check if email already exists
  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  // Validate password strength
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const user = await User.create({
    name,
    email,
    password, // hashed by pre-save hook
    picture: null,
    role: role || 'user',
  });

  return user;
};

/**
 * Login with email + password
 */
export const loginWithEmail = async ({ email, password, role }) => {
  // 1. If trying to log in as admin, STRICTLY enforce that the email matches ADMIN_EMAIL
  if (role === 'admin' && email !== process.env.ADMIN_EMAIL) {
    throw new Error('You are not authorized to login as an admin');
  }

  // Need to explicitly select password since select:false in schema
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // 2. If trying to log in as a regular user, do not allow the admin email to be used
  // (Optional depending on requirements, but generally good practice to isolate accounts)
  if (role === 'user' && user.role === 'admin') {
    throw new Error('This account is an admin account. Please select Admin role to login.');
  }

  if (!user.password) {
    throw new Error('This account uses Google sign-in. Please log in with Google.');
  }

  // 3. Ensure the requested role matches the user's actual database role
  if (role && user.role !== role) {
    throw new Error(`Your account profile does not have the '${role}' role`);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }

  return user;
};

// ─────────────────────────────────────────────
//  JWT helpers
// ─────────────────────────────────────────────

/**
 * Generate JWT token
 */
export const generateJWT = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    name: user.name,
    role: user.role || 'user',
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

/**
 * Verify JWT token
 */
export const verifyJWT = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// ─────────────────────────────────────────────
//  Gmail OTP login
// ─────────────────────────────────────────────

function getEmailTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * Send OTP to Gmail address and store in Redis.
 * Only allows @gmail.com addresses.
 */
export const sendGmailOtp = async (email) => {
  const normalized = String(email).trim().toLowerCase();
  if (!normalized.endsWith('@gmail.com')) {
    throw new Error('Please use a Gmail address (@gmail.com) for OTP login.');
  }

  const redis = getRedisClient();
  const sentKey = `${OTP_SENT_PREFIX}${normalized}`;
  const exists = await redis.get(sentKey);
  if (exists) {
    throw new Error(`Please wait ${OTP_RATE_LIMIT_SEC} seconds before requesting another OTP.`);
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const storageKey = `${OTP_PREFIX}${normalized}`;
  await redis.setex(storageKey, OTP_TTL_SEC, otp);
  await redis.setex(sentKey, OTP_RATE_LIMIT_SEC, '1');

  const transporter = getEmailTransporter();
  if (!transporter) {
    throw new Error('Email service is not configured. Please use Google or password login.');
  }

  await transporter.sendMail({
    from: `"CodeClash" <${process.env.SMTP_USER}>`,
    to: normalized,
    subject: 'Your CodeClash login code',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;">
        <h2 style="color:#ff7a00;">CodeClash</h2>
        <p>Your one-time login code is:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:4px;color:#1a1a2e;">${otp}</p>
        <p style="color:#666;font-size:12px;">This code expires in 5 minutes. If you didn't request it, you can ignore this email.</p>
      </div>
    `,
  });

  return { success: true, message: 'OTP sent to your Gmail.' };
};

/**
 * Verify OTP and return user (find or create). Only for @gmail.com.
 */
export const verifyGmailOtp = async (email, otp) => {
  const normalized = String(email).trim().toLowerCase();
  if (!normalized.endsWith('@gmail.com')) {
    throw new Error('Please use a Gmail address for OTP login.');
  }

  const redis = getRedisClient();
  const storageKey = `${OTP_PREFIX}${normalized}`;
  const stored = await redis.get(storageKey);
  if (!stored) {
    throw new Error('OTP expired or invalid. Please request a new code.');
  }
  if (stored !== String(otp).trim()) {
    throw new Error('Invalid OTP. Please check and try again.');
  }
  await redis.del(storageKey);

  let user = await User.findOne({ email: normalized });
  if (!user) {
    const name = normalized.split('@')[0].replace(/[._]/g, ' ');
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    user = await User.create({
      email: normalized,
      name: displayName,
      picture: null,
      role: 'user',
    });
  }
  return user;
};