const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with that email or username' });
    }
    
    // Create new user
    const newUser = new User({
      username,
      email,
      password
    });
    
    // Save user to database
    const savedUser = await newUser.save();
    
    // Create default settings for user
    const newSettings = new Settings({
      userId: savedUser._id
    });
    
    await newSettings.save();
    
    res.status(201).json({ 
      message: 'User registered successfully',
      userId: savedUser._id
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Find user
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Compare password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Create token
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'none',
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.json({ 
      message: 'Login successful',
      userId: user._id,
      username: user.username,
      email: user.email
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Check if user is logged in
router.get('/status', async (req, res) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.json({ isLoggedIn: false });
    }
    
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!verified) {
      return res.json({ isLoggedIn: false });
    }
    
    const user = await User.findById(verified.id).select('-password');
    
    if (!user) {
      return res.json({ isLoggedIn: false });
    }
    
    res.json({
      isLoggedIn: true,
      userId: user._id,
      username: user.username,
      email: user.email
    });
    
  } catch (error) {
    console.error('Auth status error:', error);
    res.json({ isLoggedIn: false });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
    
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error getting profile' });
  }
});

module.exports = router;