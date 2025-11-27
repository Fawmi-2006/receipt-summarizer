const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register with email/password - UPDATED
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Create new user without password first
    const user = new User({
      email,
      name,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Save user first
    await user.save();

    // Then set password using our manual method
    await user.setPassword(password);

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error during registration'
    });
  }
});

// Login with email/password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check if user has password (not Google OAuth only)
    if (!user.password) {
      return res.status(400).json({ error: 'Please use Google Sign-In for this account' });
    }

    // Check password using async method
    const isMatch = await user.comparePasswordAsync(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last login without triggering middleware
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      loginCount: (user.loginCount || 0) + 1,
      updatedAt: new Date()
    });

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error during login'
    });
  }
});

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login?error=oauth_failed',
    session: false 
  }),
  (req, res) => {
    try {
      if (!req.user) {
        console.error('No user in request after Google OAuth');
        return res.redirect('/login?error=oauth_failed');
      }

      console.log('Google OAuth callback successful for user:', req.user.email);
      
      // Successful authentication
      const token = generateToken(req.user._id);
      
      // Redirect to frontend with token
      const redirectUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}?token=${token}&success=true`;
      console.log('Redirecting to:', redirectUrl);
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('OAuth callback processing error:', error);
      res.redirect('/login?error=oauth_failed');
    }
  }
);

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

// Logout
router.post('/logout', auth, (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;