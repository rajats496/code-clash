import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { User } from '../models/User.model.js';
import { getRedisClient } from '../config/redis.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Signup OTP (stored on user document)
const OTP_EXPIRY_MS = 10 * 60 * 1000;       // 10 min
const OTP_RESEND_WINDOW_SEC = 60;           // resend only after 60s
const OTP_ATTEMPTS_MAX = 5;
const OTP_ATTEMPTS_WINDOW_SEC = 15 * 60;   // 15 min
const OTP_RESEND_REDIS_PREFIX = 'otp:resend:';
const OTP_ATTEMPTS_REDIS_PREFIX = 'otp:attempts:';

const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;  // 15 min
const FORGOT_PASSWORD_REDIS_PREFIX = 'forgot:';
const FORGOT_PASSWORD_MAX_PER_EMAIL = 3;
const FORGOT_PASSWORD_WINDOW_SEC = 15 * 60;    // 15 min

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

function getEmailTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function sendOtpEmail(toEmail, otp, subject = 'Your CodeClash verification code') {
  const transporter = getEmailTransporter();
  if (!transporter) throw new Error('Email service is not configured.');
  return transporter.sendMail({
    from: `"CodeClash" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;">
        <h2 style="color:#ff7a00;">CodeClash</h2>
        <p>Your verification code is:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:4px;color:#1a1a2e;">${otp}</p>
        <p style="color:#666;font-size:12px;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Register: create user with isVerified=false, send OTP. No JWT until OTP verified.
 */
export const registerWithEmail = async ({ name, email, password, role }) => {
  if (role === 'admin' && email !== process.env.ADMIN_EMAIL) {
    throw new Error('You are not authorized to register as an admin');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    picture: null,
    role: role || 'user',
    isVerified: false,
    otp,
    otpExpires,
  });

  await sendOtpEmail(normalizedEmail, otp);
  return { user, message: 'Verification code sent to your email.' };
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

  if (user.isVerified === false) {
    throw new Error('Please verify your email. Check your inbox for the verification code.');
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
//  Signup OTP verification
// ─────────────────────────────────────────────

/**
 * Verify signup OTP and mark user verified. Returns user for JWT.
 */
export const verifySignupOtp = async (email, otp) => {
  const normalized = String(email).trim().toLowerCase();
  const redis = getRedisClient();

  const attemptsKey = `${OTP_ATTEMPTS_REDIS_PREFIX}${normalized}`;
  const attempts = await redis.incr(attemptsKey);
  if (attempts === 1) await redis.expire(attemptsKey, OTP_ATTEMPTS_WINDOW_SEC);
  if (attempts > OTP_ATTEMPTS_MAX) {
    throw new Error('Too many failed attempts. Please request a new code.');
  }

  const user = await User.findOne({ email: normalized }).select('+otp +otpExpires');
  if (!user) {
    throw new Error('No account found for this email. Please sign up again.');
  }
  if (user.isVerified) {
    throw new Error('Account is already verified. You can sign in.');
  }
  if (!user.otp || !user.otpExpires) {
    throw new Error('Verification code expired. Please request a new code.');
  }
  if (new Date() > user.otpExpires) {
    throw new Error('Verification code expired. Please request a new code.');
  }
  if (user.otp !== String(otp).trim()) {
    throw new Error('Invalid verification code. Please check and try again.');
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();
  await redis.del(attemptsKey);
  return user;
};

/**
 * Resend signup OTP. Rate limited per email.
 */
export const resendSignupOtp = async (email) => {
  const normalized = String(email).trim().toLowerCase();
  const redis = getRedisClient();

  const resendKey = `${OTP_RESEND_REDIS_PREFIX}${normalized}`;
  const exists = await redis.get(resendKey);
  if (exists) {
    const ttl = await redis.ttl(resendKey);
    throw new Error(`Please wait ${ttl} seconds before requesting another code.`);
  }

  const user = await User.findOne({ email: normalized }).select('+otp +otpExpires');
  if (!user) {
    throw new Error('No account found for this email. Please sign up again.');
  }
  if (user.isVerified) {
    throw new Error('Account is already verified. You can sign in.');
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
  user.otp = otp;
  user.otpExpires = otpExpires;
  await user.save();

  await redis.setex(resendKey, OTP_RESEND_WINDOW_SEC, '1');
  await sendOtpEmail(normalized, otp);
  return { success: true, message: 'Verification code sent to your email.' };
};

// ─────────────────────────────────────────────
//  Forgot / Reset Password
// ─────────────────────────────────────────────

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sendResetPasswordEmail(toEmail, resetUrl) {
  const transporter = getEmailTransporter();
  if (!transporter) throw new Error('Email service is not configured.');
  return transporter.sendMail({
    from: `"CodeClash" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Reset your CodeClash password',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;">
        <h2 style="color:#ff7a00;">CodeClash</h2>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="color:#ff7a00;font-weight:bold;">Reset password</a></p>
        <p style="color:#666;font-size:12px;">This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Forgot password: if user exists (with password), generate secure token, store hashed + expiry, send link.
 * Always return same success message (do not reveal if email exists).
 */
export const forgotPassword = async (email) => {
  const normalized = String(email).trim().toLowerCase();
  const redis = getRedisClient();

  const key = `${FORGOT_PASSWORD_REDIS_PREFIX}${normalized}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, FORGOT_PASSWORD_WINDOW_SEC);
  if (count > FORGOT_PASSWORD_MAX_PER_EMAIL) {
    // Still return same message to avoid enumeration
    return { success: true, message: 'If an account exists with this email, you will receive a reset link shortly.' };
  }

  const user = await User.findOne({ email: normalized }).select('+password');
  if (user && user.password) {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashResetToken(token);
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await user.save({ validateBeforeSave: false });

    const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
    await sendResetPasswordEmail(normalized, resetUrl);
  }

  return { success: true, message: 'If an account exists with this email, you will receive a reset link shortly.' };
};

/**
 * Reset password: validate token (exists, not expired), set new password, invalidate token.
 */
export const resetPassword = async (token, newPassword) => {
  if (!token || !newPassword || newPassword.length < 6) {
    throw new Error('Invalid request. Password must be at least 6 characters.');
  }

  const hashedToken = hashResetToken(token);
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordToken +resetPasswordExpires +password');

  if (!user) {
    throw new Error('Invalid or expired reset link. Please request a new password reset.');
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return { success: true, message: 'Password has been reset. You can sign in with your new password.' };
};