const express = require('express');
const crypto = require('node:crypto');
const NotificationService = require('../services/NotificationService');

const router = express.Router();
const notificationService = new NotificationService();

/**
 * Webhook für n8n Scraping Results
 * POST /api/webhooks/n8n
 */
router.post('/n8n', async (req, res) => {
  try {
    const { webhook_secret } = req.headers;
    
    // Verify webhook secret
    if (webhook_secret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { searchId, newVehicles } = req.body;

    if (!searchId || !Array.isArray(newVehicles)) {
      return res.status(400).json({ 
        error: 'Invalid payload. Expected searchId and newVehicles array.' 
      });
    }

    console.log(`📥 Webhook: ${newVehicles.length} new vehicles for search ${searchId}`);

    // Process each new vehicle
    const results = [];
    for (const vehicle of newVehicles) {
      try {
        // Get search details and user preferences
        const { data: search, error: searchError } = await notificationService.supabase
          .from('auto_alert_searches')
          .select(`
            *,
            auto_alert_user_profiles!inner(*)
          `)
          .eq('id', searchId)
          .single();

        if (searchError) {
          console.error('Search not found:', searchError);
          continue;
        }

        const user = search.auto_alert_user_profiles;

        // Store vehicle result in database
        const { data: result, error: insertError } = await notificationService.supabase
          .from('auto_alert_results')
          .insert({
            search_id: searchId,
            mobile_ad_id: vehicle.mobileAdId,
            portal: vehicle.portal || 'mobile.de',
            title: vehicle.title,
            make: vehicle.make,
            model: vehicle.model,
            model_description: vehicle.modelDescription,
            price: vehicle.price,
            year: vehicle.year,
            mileage: vehicle.mileage,
            fuel: vehicle.fuel,
            gearbox: vehicle.gearbox,
            power: vehicle.power,
            damage_unrepaired: vehicle.damageUnrepaired,
            accident_damaged: vehicle.accidentDamaged,
            detail_url: vehicle.detailUrl,
            seller_type: vehicle.sellerType,
            seller_city: vehicle.sellerCity,
            seller_zipcode: vehicle.sellerZipcode,
            seller_company: vehicle.sellerCompany
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to insert result:', insertError);
          continue;
        }

        // Send notifications based on user preferences and search settings
        const notificationChannels = search.notification_methods || ['email'];
        
        // Determine urgency based on price
        let urgency = 'medium';
        if (vehicle.price && search.price_max) {
          const priceRatio = vehicle.price / search.price_max;
          if (priceRatio < 0.7) urgency = 'high';
          else if (priceRatio > 0.9) urgency = 'low';
        }

        // Send multi-channel notification
        const notificationResults = await notificationService.sendMultiChannel({
          userId: user.id,
          vehicleData: {
            ...vehicle,
            location: `${vehicle.sellerCity}, ${vehicle.sellerZipcode}`,
            searchName: search.name
          },
          channels: notificationChannels,
          urgency
        });

        // Update result with notification status
        await notificationService.supabase
          .from('auto_alert_results')
          .update({
            notified_at: new Date().toISOString(),
            notification_methods_sent: notificationChannels
          })
          .eq('id', result.id);

        results.push({
          vehicleId: vehicle.mobileAdId,
          stored: true,
          notifications: notificationResults
        });

        console.log(`✅ Processed ${vehicle.title} for user ${user.email}`);

      } catch (error) {
        console.error('Error processing vehicle:', error);
        results.push({
          vehicleId: vehicle.mobileAdId || 'unknown',
          stored: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${newVehicles.length} vehicles`,
      results
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed',
      details: error.message
    });
  }
});

/**
 * Retell AI Call Status Webhook
 * POST /api/webhooks/retell/call-status
 */
router.post('/retell/call-status', async (req, res) => {
  try {
    const { call_id, call_status, end_reason } = req.body;

    console.log(`📞 Retell Call Update: ${call_id} -> ${call_status}`);

    // Update notification status in database
    await notificationService.supabase
      .from('auto_alert_notifications')
      .update({
        status: call_status === 'ended' ? 'delivered' : call_status,
        delivered_at: call_status === 'ended' ? new Date().toISOString() : null
      })
      .eq('provider_id', call_id);

    res.json({ success: true });

  } catch (error) {
    console.error('Retell webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Test webhook endpoint
 * POST /api/webhooks/test
 */
router.post('/test', async (req, res) => {
  try {
    console.log('🧪 Test webhook received:', req.body);

    // Send test notification
    const testVehicle = {
      title: 'BMW 740d xDrive Test',
      price: 22500,
      year: 2018,
      mileage: 89000,
      fuel: 'Diesel',
      detailUrl: 'https://suchen.mobile.de/test',
      location: 'München, 80331',
      sellerType: 'Händler'
    };

    // Test email notification
    if (req.body.testEmail) {
      await notificationService.sendEmail({
        to: req.body.testEmail,
        subject: '🧪 Auto-Alert Test Notification',
        vehicleData: testVehicle,
        userId: 'test-user-id'
      });
    }

    // Test voice call
    if (req.body.testPhone) {
      await notificationService.sendVoiceCall({
        phoneNumber: req.body.testPhone,
        message: 'Test-Nachricht für Auto-Alert Service',
        vehicleData: testVehicle,
        urgency: 'medium',
        userId: 'test-user-id'
      });
    }

    res.json({
      success: true,
      message: 'Test notifications sent',
      testVehicle
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message
    });
  }
});

/**
 * Webhook endpoint info
 * GET /api/webhooks/info
 */
router.get('/info', (req, res) => {
  res.json({
    service: 'Auto-Alert Webhook Service',
    endpoints: {
      'POST /api/webhooks/n8n': 'Receive new vehicle data from n8n scraper',
      'POST /api/webhooks/retell/call-status': 'Receive call status updates from Retell AI',
      'POST /api/webhooks/test': 'Test webhook functionality'
    },
    headers: {
      'webhook_secret': 'Required for n8n webhook'
    },
    example_payload: {
      searchId: 'uuid-of-search',
      newVehicles: [
        {
          mobileAdId: '12345',
          title: 'BMW 740d xDrive',
          price: 22500,
          year: 2018,
          mileage: 89000,
          detailUrl: 'https://suchen.mobile.de/...'
        }
      ]
    }
  });
});

module.exports = router;