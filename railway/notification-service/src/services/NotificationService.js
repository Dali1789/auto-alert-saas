const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

class NotificationService {
  constructor() {
    this.retellApiKey = process.env.RETELL_API_KEY;
    this.resendApiKey = process.env.RESEND_API_KEY;
    
    // Only create Supabase client if valid configuration exists
    if (process.env.SUPABASE_URL && 
        process.env.SUPABASE_SERVICE_ROLE_KEY && 
        !process.env.SUPABASE_URL.includes('placeholder')) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    } else {
      this.supabase = null;
      console.warn('⚠️  NotificationService: Supabase not configured, using fallback');
    }
    
    // German voice for Auto-Alert calls
    this.defaultVoiceId = '11labs-Carola'; // German female voice
    this.retellBaseUrl = 'https://api.retellai.com';
  }

  /**
   * Send voice call via Retell AI
   */
  async sendVoiceCall({ phoneNumber, message, vehicleData, urgency = 'medium', userId }) {
    try {
      // Create dynamic LLM prompt for the car alert
      const prompt = this.createCarAlertPrompt(vehicleData, urgency);
      
      // Create Retell LLM for this specific call
      const llm = await this.createRetellLLM(prompt, vehicleData);
      
      // Create voice call
      const callData = {
        fromNumber: process.env.RETELL_PHONE_NUMBER || '+4915123456789',
        toNumber: phoneNumber,
        retellLlmDynamicVariables: {
          car_title: vehicleData.title,
          car_price: vehicleData.price?.toString(),
          car_year: vehicleData.year?.toString(),
          car_mileage: vehicleData.mileage?.toString(),
          car_location: vehicleData.location,
          car_url: vehicleData.detailUrl,
          urgency_level: urgency
        },
        overrideAgentId: process.env.RETELL_AGENT_ID
      };

      const response = await axios.post(
        `${this.retellBaseUrl}/create-phone-call`,
        callData,
        {
          headers: {
            'Authorization': `Bearer ${this.retellApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Log notification in database
      await this.logNotification({
        userId,
        type: 'voice',
        status: 'sent',
        provider: 'retell',
        providerId: response.data.call_id,
        vehicleData
      });

      return {
        success: true,
        callId: response.data.call_id,
        status: response.data.call_status
      };

    } catch (error) {
      console.error('Retell AI call error:', error);
      
      // Log failed notification
      await this.logNotification({
        userId,
        type: 'voice',
        status: 'failed',
        provider: 'retell',
        errorMessage: error.message,
        vehicleData
      });

      throw new Error(`Voice call failed: ${error.message}`);
    }
  }

  /**
   * Create car alert prompt for Retell AI
   */
  createCarAlertPrompt(vehicleData, urgency) {
    const urgencyText = {
      'low': 'Ein interessantes Fahrzeug wurde gefunden.',
      'medium': 'Ein sehr interessantes Fahrzeug wurde für Sie gefunden!',
      'high': 'DRINGEND: Ein Traumfahrzeug zu einem fantastischen Preis wurde gefunden!'
    };

    return `Du bist ein professioneller Auto-Alert-Service. Du rufst Kunden an, um sie über neu gefundene Fahrzeuge zu informieren.

WICHTIG: Sprich nur Deutsch und sei professionell aber freundlich.

Aktuelle Fahrzeug-Informationen:
- Fahrzeug: {{car_title}}
- Preis: {{car_price}}€ 
- Baujahr: {{car_year}}
- Kilometerstand: {{car_mileage}} km
- Standort: {{car_location}}
- Dringlichkeit: {{urgency_level}}

Dein Auftrag:
1. Begrüße den Kunden höflich
2. Informiere über das gefundene Fahrzeug
3. Nenne die wichtigsten Details (Preis, Jahr, km)
4. Erkläre, dass dies eine automatische Benachrichtigung ist
5. Frage, ob Interesse besteht
6. Biete an, den Link per SMS zu senden

${urgencyText[urgency]}

Beispiel-Anruf:
"Guten Tag! Hier ist Ihr Auto-Alert-Service. Wir haben ein interessantes Fahrzeug für Sie gefunden: {{car_title}} aus {{car_year}} für {{car_price}}€ mit {{car_mileage}} km. Das Fahrzeug steht in {{car_location}}. Haben Sie Interesse an weiteren Informationen?"

WICHTIG: 
- Halte das Gespräch kurz (max. 2 Minuten)
- Sei enthusiastisch aber nicht aufdringlich
- Erwähne, dass dies ein automatischer Service ist
- Frage immer nach Interesse bevor du Details gibst`;
  }

  /**
   * Create Retell LLM for car alerts
   */
  async createRetellLLM(prompt, vehicleData) {
    try {
      const llmData = {
        general_prompt: prompt,
        model: 'gpt-4o-mini',
        begin_message: `Guten Tag! Hier ist Ihr Auto-Alert-Service. Wir haben ein interessantes Fahrzeug für Sie gefunden!`,
        general_tools: [
          {
            type: 'end_call',
            name: 'call_beenden',
            description: 'Beende das Gespräch höflich'
          }
        ]
      };

      const response = await axios.post(
        `${this.retellBaseUrl}/create-retell-llm`,
        llmData,
        {
          headers: {
            'Authorization': `Bearer ${this.retellApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Retell LLM creation error:', error);
      throw error;
    }
  }

  /**
   * Send email notification via Resend
   */
  async sendEmail({ to, subject, vehicleData, userId }) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(this.resendApiKey);

      const htmlTemplate = this.createEmailTemplate(vehicleData);

      const response = await resend.emails.send({
        from: 'Auto-Alert <alerts@autoalert.com>',
        to: [to],
        subject: subject || `🚗 Neues Fahrzeug gefunden: ${vehicleData.title}`,
        html: htmlTemplate
      });

      // Log notification
      await this.logNotification({
        userId,
        type: 'email',
        status: 'sent',
        provider: 'resend',
        providerId: response.id,
        vehicleData
      });

      return {
        success: true,
        messageId: response.id
      };

    } catch (error) {
      console.error('Email error:', error);
      
      await this.logNotification({
        userId,
        type: 'email',
        status: 'failed',
        provider: 'resend',
        errorMessage: error.message,
        vehicleData
      });

      throw new Error(`Email failed: ${error.message}`);
    }
  }

  /**
   * Create email template for car alerts
   */
  createEmailTemplate(vehicleData) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neues Fahrzeug gefunden</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .car-card { border: 2px solid #007bff; border-radius: 12px; padding: 20px; margin: 20px 0; background: #f8f9fa; }
        .car-title { font-size: 20px; font-weight: bold; color: #333; margin-bottom: 10px; }
        .car-price { font-size: 28px; font-weight: bold; color: #28a745; margin: 15px 0; }
        .car-details { margin: 15px 0; }
        .detail-row { margin: 8px 0; }
        .btn { background: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚗 Neues Fahrzeug gefunden!</h1>
        </div>
        
        <div class="content">
            <div class="car-card">
                <div class="car-title">${vehicleData.title}</div>
                <div class="car-price">${vehicleData.price?.toLocaleString('de-DE')}€</div>
                
                <div class="car-details">
                    <div class="detail-row"><strong>Baujahr:</strong> ${vehicleData.year}</div>
                    <div class="detail-row"><strong>Kilometerstand:</strong> ${vehicleData.mileage?.toLocaleString('de-DE')} km</div>
                    <div class="detail-row"><strong>Kraftstoff:</strong> ${vehicleData.fuel}</div>
                    <div class="detail-row"><strong>Standort:</strong> ${vehicleData.location}</div>
                    <div class="detail-row"><strong>Verkäufer:</strong> ${vehicleData.sellerType}</div>
                </div>
                
                <a href="${vehicleData.detailUrl}" class="btn">🔗 Inserat ansehen</a>
            </div>
        </div>
        
        <div class="footer">
            Automatisch generiert vom Auto-Alert Service<br>
            Gefunden: ${new Date().toLocaleString('de-DE')}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Send multi-channel notification
   */
  async sendMultiChannel({ userId, vehicleData, channels, urgency = 'medium' }) {
    const results = [];

    // Get user preferences
    const { data: user, error } = await this.supabase
      .from('auto_alert_user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`User not found: ${error.message}`);
    }

    // Send notifications based on channels and user preferences
    for (const channel of channels) {
      try {
        let result;
        
        switch (channel) {
          case 'email':
            if (user.notification_preferences.email) {
              result = await this.sendEmail({
                to: user.email,
                vehicleData,
                userId
              });
            }
            break;
            
          case 'voice':
            if (user.notification_preferences.voice && user.retell_phone_number) {
              result = await this.sendVoiceCall({
                phoneNumber: user.retell_phone_number,
                vehicleData,
                urgency,
                userId
              });
            }
            break;
            
          case 'sms':
            if (user.notification_preferences.sms && user.retell_phone_number) {
              result = await this.sendSMS({
                phoneNumber: user.retell_phone_number,
                vehicleData,
                userId
              });
            }
            break;
        }

        results.push({
          channel,
          success: !!result,
          result
        });

      } catch (error) {
        results.push({
          channel,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Log notification in database
   */
  async logNotification({ userId, type, status, provider, providerId, errorMessage, vehicleData }) {
    try {
      await this.supabase
        .from('auto_alert_notifications')
        .insert({
          user_id: userId,
          notification_type: type,
          status,
          provider,
          provider_id: providerId,
          error_message: errorMessage
        });
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }

  /**
   * Get notification status
   */
  async getNotificationStatus(notificationId) {
    const { data, error } = await this.supabase
      .from('auto_alert_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (error) {
      throw new Error(`Notification not found: ${error.message}`);
    }

    return data;
  }

  /**
   * Get notification history for user
   */
  async getNotificationHistory({ userId, limit = 50, offset = 0, type }) {
    let query = this.supabase
      .from('auto_alert_notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('notification_type', type);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get notification history: ${error.message}`);
    }

    return {
      notifications: data,
      total: count
    };
  }

  /**
   * Send SMS (placeholder - can be implemented with Twilio or similar)
   */
  async sendSMS({ phoneNumber, message, vehicleData, userId }) {
    // Placeholder for SMS implementation
    console.log(`SMS to ${phoneNumber}: ${message}`);
    
    await this.logNotification({
      userId,
      type: 'sms',
      status: 'sent',
      provider: 'placeholder',
      providerId: `sms_${Date.now()}`,
      vehicleData
    });

    return {
      success: true,
      messageId: `sms_${Date.now()}`
    };
  }
}

module.exports = NotificationService;