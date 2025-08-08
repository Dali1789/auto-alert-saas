const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('./auth');
const DatabaseService = require('../services/DatabaseService');

const router = express.Router();

// Subscription tiers configuration
const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    maxAlerts: 2,
    searchFrequency: 24, // hours
    notificationChannels: ['email'],
    features: ['Basic email notifications', 'Manual search triggers']
  },
  basic: {
    name: 'Basic',
    price: 9.99,
    maxAlerts: 10,
    searchFrequency: 6, // hours
    notificationChannels: ['email', 'sms'],
    features: ['Email & SMS notifications', 'Automated searches every 6 hours', 'Priority support']
  },
  premium: {
    name: 'Premium',
    price: 19.99,
    maxAlerts: 50,
    searchFrequency: 1, // hours
    notificationChannels: ['email', 'sms', 'voice'],
    features: ['All notification types', 'Real-time search updates', 'Advanced filters', 'API access', 'Premium support']
  },
  enterprise: {
    name: 'Enterprise',
    price: 49.99,
    maxAlerts: 200,
    searchFrequency: 0.5, // hours (30 minutes)
    notificationChannels: ['email', 'sms', 'voice'],
    features: ['Unlimited searches', 'Custom integrations', 'White-label solution', 'Dedicated support']
  }
};

/**
 * Get Available Subscription Plans
 * GET /api/subscriptions/plans
 */
router.get('/plans', (req, res) => {
  try {
    const plans = Object.entries(SUBSCRIPTION_TIERS).map(([key, plan]) => ({
      id: key,
      ...plan
    }));

    res.json({
      success: true,
      plans,
      currency: 'EUR',
      billingPeriod: 'monthly'
    });

  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription plans',
      details: error.message
    });
  }
});

/**
 * Get Current User Subscription
 * GET /api/subscriptions/current
 */
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const subscription = await DatabaseService.getUserSubscription(req.user.userId);
    
    if (!subscription) {
      // User has no subscription, default to free
      return res.json({
        success: true,
        subscription: {
          id: null,
          tier: 'free',
          status: 'active',
          ...SUBSCRIPTION_TIERS.free,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          alertsUsed: await DatabaseService.getUserActiveAlertsCount(req.user.userId)
        }
      });
    }

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        ...SUBSCRIPTION_TIERS[subscription.tier],
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        alertsUsed: await DatabaseService.getUserActiveAlertsCount(req.user.userId),
        createdAt: subscription.created_at,
        updatedAt: subscription.updated_at
      }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription',
      details: error.message
    });
  }
});

/**
 * Create/Upgrade Subscription
 * POST /api/subscriptions/create
 */
router.post('/create', authenticateToken, [
  body('tier').isIn(['free', 'basic', 'premium', 'enterprise']).withMessage('Invalid subscription tier'),
  body('paymentMethodId').optional().isString().withMessage('Payment method ID must be string'),
  body('billingAddress').optional().isObject().withMessage('Billing address must be object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tier, paymentMethodId, billingAddress } = req.body;

    // Check if user already has a subscription
    const existingSubscription = await DatabaseService.getUserSubscription(req.user.userId);
    
    if (existingSubscription && existingSubscription.tier === tier) {
      return res.status(400).json({
        success: false,
        error: `Already subscribed to ${tier} plan`
      });
    }

    // For paid tiers, payment processing would happen here
    if (tier !== 'free' && !paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Payment method required for paid subscriptions'
      });
    }

    // Calculate billing period
    const now = new Date();
    const periodEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    let subscription;
    if (existingSubscription) {
      // Update existing subscription
      subscription = await DatabaseService.updateSubscription(existingSubscription.id, {
        tier,
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        paymentMethodId,
        billingAddress
      });
    } else {
      // Create new subscription
      subscription = await DatabaseService.createSubscription({
        userId: req.user.userId,
        tier,
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        paymentMethodId,
        billingAddress
      });
    }

    // Log subscription event
    await DatabaseService.logSubscriptionEvent({
      subscriptionId: subscription.id,
      eventType: existingSubscription ? 'tier_changed' : 'subscription_created',
      data: { fromTier: existingSubscription?.tier, toTier: tier }
    });

    res.status(201).json({
      success: true,
      message: `Successfully ${existingSubscription ? 'upgraded to' : 'subscribed to'} ${tier} plan`,
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        ...SUBSCRIPTION_TIERS[tier],
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end
      }
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription',
      details: error.message
    });
  }
});

/**
 * Cancel Subscription
 * POST /api/subscriptions/cancel
 */
router.post('/cancel', authenticateToken, [
  body('cancelAtPeriodEnd').optional().isBoolean().withMessage('Cancel at period end must be boolean'),
  body('reason').optional().isString().withMessage('Cancellation reason must be string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cancelAtPeriodEnd = true, reason } = req.body;

    const subscription = await DatabaseService.getUserSubscription(req.user.userId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    if (subscription.tier === 'free') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel free subscription'
      });
    }

    // Update subscription
    const updatedSubscription = await DatabaseService.updateSubscription(subscription.id, {
      cancelAtPeriodEnd,
      status: cancelAtPeriodEnd ? 'active' : 'cancelled',
      cancelledAt: cancelAtPeriodEnd ? null : new Date().toISOString(),
      cancellationReason: reason
    });

    // Log cancellation event
    await DatabaseService.logSubscriptionEvent({
      subscriptionId: subscription.id,
      eventType: 'subscription_cancelled',
      data: { cancelAtPeriodEnd, reason }
    });

    res.json({
      success: true,
      message: cancelAtPeriodEnd 
        ? 'Subscription will be cancelled at the end of current period' 
        : 'Subscription cancelled immediately',
      subscription: {
        id: updatedSubscription.id,
        tier: updatedSubscription.tier,
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd: updatedSubscription.current_period_end
      }
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
      details: error.message
    });
  }
});

/**
 * Get Subscription Usage/Statistics
 * GET /api/subscriptions/usage
 */
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const subscription = await DatabaseService.getUserSubscription(req.user.userId);
    const tier = subscription ? subscription.tier : 'free';
    const limits = SUBSCRIPTION_TIERS[tier];

    const usage = await DatabaseService.getUserUsageStats(req.user.userId);

    res.json({
      success: true,
      usage: {
        tier,
        alertsUsed: usage.activeAlerts,
        alertsLimit: limits.maxAlerts,
        searchesThisMonth: usage.searchesThisMonth,
        notificationsSent: usage.notificationsThisMonth,
        lastSearchRun: usage.lastSearchRun,
        storageUsed: usage.storageUsed || 0,
        apiCallsThisMonth: usage.apiCallsThisMonth || 0
      },
      limits: {
        maxAlerts: limits.maxAlerts,
        searchFrequency: limits.searchFrequency,
        availableChannels: limits.notificationChannels,
        features: limits.features
      },
      warnings: {
        alertsNearLimit: usage.activeAlerts >= (limits.maxAlerts * 0.8),
        subscriptionExpiring: subscription && subscription.current_period_end && 
          new Date(subscription.current_period_end) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage statistics',
      details: error.message
    });
  }
});

/**
 * Get Billing History
 * GET /api/subscriptions/billing-history
 */
router.get('/billing-history', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const history = await DatabaseService.getUserBillingHistory({
      userId: req.user.userId,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      billingHistory: history.records.map(record => ({
        id: record.id,
        amount: record.amount,
        currency: record.currency,
        status: record.status,
        description: record.description,
        invoiceUrl: record.invoice_url,
        billingPeriodStart: record.billing_period_start,
        billingPeriodEnd: record.billing_period_end,
        paidAt: record.paid_at,
        createdAt: record.created_at
      })),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: history.total,
        hasMore: history.total > parseInt(offset) + parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get billing history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get billing history',
      details: error.message
    });
  }
});

/**
 * Update Payment Method
 * PUT /api/subscriptions/payment-method
 */
router.put('/payment-method', authenticateToken, [
  body('paymentMethodId').isString().withMessage('Payment method ID required'),
  body('billingAddress').optional().isObject().withMessage('Billing address must be object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentMethodId, billingAddress } = req.body;

    const subscription = await DatabaseService.getUserSubscription(req.user.userId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No subscription found'
      });
    }

    // Update payment method
    const updatedSubscription = await DatabaseService.updateSubscription(subscription.id, {
      paymentMethodId,
      billingAddress
    });

    // Log payment method update
    await DatabaseService.logSubscriptionEvent({
      subscriptionId: subscription.id,
      eventType: 'payment_method_updated',
      data: { paymentMethodId }
    });

    res.json({
      success: true,
      message: 'Payment method updated successfully',
      subscription: {
        id: updatedSubscription.id,
        tier: updatedSubscription.tier,
        status: updatedSubscription.status
      }
    });

  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment method',
      details: error.message
    });
  }
});

/**
 * Middleware to check subscription limits
 */
const checkSubscriptionLimits = async (req, res, next) => {
  try {
    const subscription = await DatabaseService.getUserSubscription(req.user.userId);
    const tier = subscription ? subscription.tier : 'free';
    const limits = SUBSCRIPTION_TIERS[tier];

    // Check alert limit
    if (req.method === 'POST' && req.baseUrl.includes('/alerts')) {
      const activeAlerts = await DatabaseService.getUserActiveAlertsCount(req.user.userId);
      if (activeAlerts >= limits.maxAlerts) {
        return res.status(403).json({
          success: false,
          error: `Alert limit reached. Upgrade to create more than ${limits.maxAlerts} alerts.`,
          upgradeRequired: true,
          currentTier: tier
        });
      }
    }

    // Add limits to request for use in other routes
    req.subscriptionLimits = limits;
    req.currentTier = tier;
    
    next();
  } catch (error) {
    console.error('Check subscription limits error:', error);
    next(); // Continue anyway
  }
};

module.exports = { router, checkSubscriptionLimits, SUBSCRIPTION_TIERS };