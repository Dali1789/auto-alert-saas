const express = require('express');
const { body, validationResult } = require('express-validator');
const NotificationService = require('../services/NotificationService');

const router = express.Router();
const notificationService = new NotificationService();

/**
 * Send voice call notification via Retell AI
 * POST /api/notifications/voice
 */
router.post('/voice', [
  body('phoneNumber').isMobilePhone('de-DE').withMessage('Valid German phone number required'),
  body('message').isLength({ min: 10, max: 500 }).withMessage('Message must be 10-500 characters'),
  body('vehicleData').isObject().withMessage('Vehicle data required'),
  body('urgency').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid urgency level')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phoneNumber, message, vehicleData, urgency = 'medium', userId } = req.body;

    // Create voice call via Retell AI
    const result = await notificationService.sendVoiceCall({
      phoneNumber,
      message,
      vehicleData,
      urgency,
      userId
    });

    res.json({
      success: true,
      message: 'Voice call initiated successfully',
      callId: result.callId,
      status: result.status
    });

  } catch (error) {
    console.error('Voice call error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate voice call',
      details: error.message
    });
  }
});

/**
 * Send email notification via Resend
 * POST /api/notifications/email
 */
router.post('/email', [
  body('to').isEmail().withMessage('Valid email address required'),
  body('subject').isLength({ min: 5, max: 100 }).withMessage('Subject must be 5-100 characters'),
  body('vehicleData').isObject().withMessage('Vehicle data required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { to, subject, vehicleData, userId } = req.body;

    const result = await notificationService.sendEmail({
      to,
      subject,
      vehicleData,
      userId
    });

    res.json({
      success: true,
      message: 'Email sent successfully',
      messageId: result.messageId
    });

  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: error.message
    });
  }
});

/**
 * Send SMS notification
 * POST /api/notifications/sms
 */
router.post('/sms', [
  body('phoneNumber').isMobilePhone('de-DE').withMessage('Valid German phone number required'),
  body('message').isLength({ min: 10, max: 160 }).withMessage('SMS must be 10-160 characters'),
  body('vehicleData').isObject().withMessage('Vehicle data required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phoneNumber, message, vehicleData, userId } = req.body;

    const result = await notificationService.sendSMS({
      phoneNumber,
      message,
      vehicleData,
      userId
    });

    res.json({
      success: true,
      message: 'SMS sent successfully',
      messageId: result.messageId
    });

  } catch (error) {
    console.error('SMS error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send SMS',
      details: error.message
    });
  }
});

/**
 * Send multi-channel notification
 * POST /api/notifications/multi
 */
router.post('/multi', [
  body('userId').isUUID().withMessage('Valid user ID required'),
  body('vehicleData').isObject().withMessage('Vehicle data required'),
  body('channels').isArray().withMessage('Channels array required'),
  body('channels.*').isIn(['email', 'sms', 'voice']).withMessage('Invalid notification channel')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, vehicleData, channels, urgency = 'medium' } = req.body;

    const results = await notificationService.sendMultiChannel({
      userId,
      vehicleData,
      channels,
      urgency
    });

    res.json({
      success: true,
      message: 'Multi-channel notifications initiated',
      results
    });

  } catch (error) {
    console.error('Multi-channel notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send multi-channel notifications',
      details: error.message
    });
  }
});

/**
 * Get notification status
 * GET /api/notifications/status/:notificationId
 */
router.get('/status/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;

    const status = await notificationService.getNotificationStatus(notificationId);

    res.json({
      success: true,
      notification: status
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification status',
      details: error.message
    });
  }
});

/**
 * Get user's notification history
 * GET /api/notifications/history/:userId
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, type } = req.query;

    const history = await notificationService.getNotificationHistory({
      userId,
      limit: parseInt(limit),
      offset: parseInt(offset),
      type
    });

    res.json({
      success: true,
      notifications: history.notifications,
      total: history.total,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: history.total > parseInt(offset) + parseInt(limit)
      }
    });

  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification history',
      details: error.message
    });
  }
});

module.exports = router;