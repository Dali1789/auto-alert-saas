const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const DatabaseService = require('../services/DatabaseService');
const config = require('../config/environment');

const router = express.Router();
const appConfig = config.getConfig();

/**
 * User Registration
 * POST /api/auth/register
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('name').isLength({ min: 2, max: 100 }).trim().withMessage('Name must be 2-100 characters'),
  body('phone').optional().isMobilePhone('de-DE').withMessage('Valid German phone number required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('preferences.notifications').optional().isArray().withMessage('Notifications must be array'),
  body('preferences.notifications.*').optional().isIn(['email', 'sms', 'voice']).withMessage('Invalid notification type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, phone, password, preferences = {} } = req.body;

    // Check if user already exists
    const existingUser = await DatabaseService.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Create user profile
    const userProfile = await DatabaseService.createUserProfile({
      email,
      name,
      phone,
      preferences: {
        notifications: preferences.notifications || ['email'],
        ...preferences
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: userProfile.id,
        email: userProfile.email,
        name: userProfile.name
      },
      appConfig.auth.jwtSecret,
      { expiresIn: appConfig.auth.jwtExpiresIn }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        phone: userProfile.phone,
        preferences: userProfile.preferences,
        createdAt: userProfile.created_at
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user',
      details: error.message
    });
  }
});

/**
 * User Login
 * POST /api/auth/login
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 1 }).withMessage('Password required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await DatabaseService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // In a real app, verify password hash here
    // For now, we'll accept any password (development mode)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement proper password hashing verification
      console.warn('⚠️ Password verification not implemented - development mode only');
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        name: user.name
      },
      appConfig.auth.jwtSecret,
      { expiresIn: appConfig.auth.jwtExpiresIn }
    );

    // Update last login
    await DatabaseService.updateUserLastLogin(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        preferences: user.preferences,
        lastLogin: new Date().toISOString()
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      details: error.message
    });
  }
});

/**
 * Get Current User Profile
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await DatabaseService.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        preferences: user.preferences,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile',
      details: error.message
    });
  }
});

/**
 * Update User Profile
 * PUT /api/auth/profile
 */
router.put('/profile', authenticateToken, [
  body('name').optional().isLength({ min: 2, max: 100 }).trim().withMessage('Name must be 2-100 characters'),
  body('phone').optional().isMobilePhone('de-DE').withMessage('Valid German phone number required'),
  body('preferences').optional().isObject().withMessage('Preferences must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = {};
    const { name, phone, preferences } = req.body;

    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (preferences !== undefined) updates.preferences = preferences;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    const updatedUser = await DatabaseService.updateUserProfile(req.user.userId, updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        preferences: updatedUser.preferences,
        updatedAt: updatedUser.updated_at
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      details: error.message
    });
  }
});

/**
 * Token Verification Middleware
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, appConfig.auth.jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
}

/**
 * Refresh Token
 * POST /api/auth/refresh
 */
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Generate new token with extended expiration
    const newToken = jwt.sign(
      { 
        userId: req.user.userId,
        email: req.user.email,
        name: req.user.name
      },
      appConfig.auth.jwtSecret,
      { expiresIn: appConfig.auth.jwtExpiresIn }
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
      details: error.message
    });
  }
});

// Export middleware for other routes
module.exports = { router, authenticateToken };