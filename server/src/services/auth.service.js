import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google ID token and get user info
 * @param {string} token - Google ID token from frontend
 * @returns {Promise<Object>} - User payload from Google
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
 * Find or create user in database
 * @param {Object} googleUser - User info from Google
 * @returns {Promise<Object>} - User document from MongoDB
 */
export const findOrCreateUser = async (googleUser) => {
  let user = await User.findOne({ googleId: googleUser.googleId });

  if (!user) {
    // Create new user
    user = await User.create({
      googleId: googleUser.googleId,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
    });
  } else {
    // Update existing user (in case name/picture changed)
    user.name = googleUser.name;
    user.picture = googleUser.picture;
    await user.save();
  }

  return user;
};

/**
 * Generate JWT token
 * @param {Object} user - User document from MongoDB
 * @returns {string} - Signed JWT token
 */
export const generateJWT = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    name: user.name,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d', // Token expires in 7 days
  });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded payload
 */
export const verifyJWT = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};