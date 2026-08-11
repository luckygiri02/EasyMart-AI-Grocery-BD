// server/controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || ''; // e.g. http://localhost:5173

/**
 * Register a new user
 */
// server/controllers/authController.js

exports.register = async (req, res) => {
  try {
    const { name, email, phoneNumber, password, address } = req.body;

    if (!name || !email || !phoneNumber || !password || !address) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const existingPhone = await User.findOne({ phoneNumber });
    if (existingPhone) {
      return res.status(400).json({ message: 'Phone already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 🔥 NEW SYSTEM (IMPORTANT)
    const user = new User({
      name,
      email,
      phoneNumber,
      password: hashedPassword,
      role: 'user',

      // ✅ FIXED
      addresses: [
        {
          ...address,
          isDefault: true
        }
      ]
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      role: user.role
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
/**
 * Login using email or phone (identifier) and password
 */
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Identifier and password are required' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phoneNumber: identifier }],
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get profile for authenticated user
 * Requires auth middleware to set req.user = { id, ... }
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('GetProfile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update profile (password allowed). Prevent changing email/phone.
 */
exports.updateProfile = async (req, res) => {
  try {
    const { email, phoneNumber, ...updateData } = req.body;

    // Prevent changing email and phone number
    if (email || phoneNumber) {
      return res.status(400).json({ message: 'Email and phone number cannot be changed' });
    }

    // Handle password update separately
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('UpdateProfile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /forgot-password
 * Body: { email }
 * Generates a token, stores it on the user (with expiry) and emails a reset link.
 * Always returns a generic message to avoid leaking user existence.
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });

    // Generic response even if user doesn't exist
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Generate token and expiry (15 minutes)
    const token = crypto.randomBytes(20).toString('hex');
    const expires = Date.now() + 15 * 60 * 1000;

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    // Normalize FRONTEND_URL to avoid duplicate slashes
    let base = (process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`).trim();
    base = base.replace(/\/+$/, ''); // remove trailing slashes

    const resetLink = `${base}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    // Send email and log result (debug)
    const sendResult = await sendPasswordResetEmail(user.name || 'User', email, resetLink);
    console.log('forgotPassword -> sendResult:', JSON.stringify(sendResult, null, 2));
    console.log('forgotPassword -> resetLink (debug):', resetLink);

    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('ForgotPassword error:', error);
    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  }
};

/**
 * POST /reset-password
 * Body: { token, password, email? }
 * Reset password if token valid and not expired.
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, email } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const now = Date.now();
    const query = { resetPasswordToken: token, resetPasswordExpires: { $gt: now } };
    if (email) query.email = email;

    const user = await User.findOne(query);
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Clear reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Optionally: you could emit an event or email a confirmation here (not required)
    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('ResetPassword error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
