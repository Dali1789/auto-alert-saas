const { Client, Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/environment');

/**
 * Database Service for Railway PostgreSQL and Supabase compatibility
 * Handles both Railway PostgreSQL and Supabase connections
 */
class DatabaseService {
  constructor() {
    this.config = config.getConfig();
    this.pool = null;
    this.supabase = null;
    this.isPostgreSQL = false;
    this.isSupabase = false;
    
    this.initializeConnection();
  }

  initializeConnection() {
    console.log('🔗 Initializing database connection...');
    
    // Try PostgreSQL first (Railway)
    if (this.config.database.databaseUrl) {
      console.log('📊 Connecting to PostgreSQL...');
      this.pool = new Pool({
        connectionString: this.config.database.databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      this.isPostgreSQL = true;
      console.log('✅ PostgreSQL connection initialized');
    }
    // Fallback to Supabase
    else if (this.config.database.supabaseUrl && this.config.database.supabaseServiceKey) {
      console.log('📊 Connecting to Supabase...');
      this.supabase = createClient(
        this.config.database.supabaseUrl,
        this.config.database.supabaseServiceKey
      );
      this.isSupabase = true;
      console.log('✅ Supabase connection initialized');
    }
    else {
      console.warn('⚠️  No database connection available');
      console.log('📝 Running without database (development mode)');
      
      // Only fail in Railway production
      if (process.env.NODE_ENV === 'production' && process.env.RAILWAY_ENVIRONMENT) {
        throw new Error('Database connection required in Railway production');
      }
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck() {
    try {
      if (this.isPostgreSQL && this.pool) {
        const client = await this.pool.connect();
        const result = await client.query('SELECT NOW(), version()');
        client.release();
        
        return {
          status: 'healthy',
          type: 'postgresql',
          version: result.rows[0].version,
          timestamp: result.rows[0].now
        };
      }
      else if (this.isSupabase && this.supabase) {
        const { data, error } = await this.supabase
          .from('auto_alert_user_profiles')
          .select('count')
          .limit(1);
          
        if (error && !error.message.includes('relation "auto_alert_user_profiles" does not exist')) {
          throw error;
        }
        
        return {
          status: 'healthy',
          type: 'supabase',
          timestamp: new Date().toISOString()
        };
      }
      else {
        return {
          status: 'not_configured',
          type: 'none',
          message: 'No database configured (development mode)'
        };
      }
    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        status: 'error',
        error: error.message,
        type: this.isPostgreSQL ? 'postgresql' : 'supabase'
      };
    }
  }

  /**
   * Execute a raw SQL query (PostgreSQL only)
   */
  async query(sql, params = []) {
    if (!this.isPostgreSQL) {
      throw new Error('Raw SQL queries only supported with PostgreSQL');
    }
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Get user profiles
   */
  async getUserProfiles(limit = 10) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        'SELECT * FROM auto_alert.auto_alert_user_profiles ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      return result.rows;
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_user_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
        
      if (error) throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Create a new user profile
   */
  async createUserProfile(userData) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        `INSERT INTO auto_alert.auto_alert_user_profiles 
         (email, name, phone, preferences) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [userData.email, userData.name, userData.phone, userData.preferences || {}]
      );
      return result.rows[0];
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_user_profiles')
        .insert(userData)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      if (this.isPostgreSQL) {
        const tables = await this.query(`
          SELECT 
            'user_profiles' as table_name,
            COUNT(*) as count
          FROM auto_alert.auto_alert_user_profiles
          UNION ALL
          SELECT 
            'search_criteria' as table_name,
            COUNT(*) as count
          FROM auto_alert.auto_alert_search_criteria
          UNION ALL
          SELECT 
            'found_vehicles' as table_name,
            COUNT(*) as count
          FROM auto_alert.auto_alert_found_vehicles
          UNION ALL
          SELECT 
            'notifications' as table_name,
            COUNT(*) as count
          FROM auto_alert.auto_alert_notifications
        `);
        
        const stats = {};
        tables.rows.forEach(row => {
          stats[row.table_name] = parseInt(row.count);
        });
        
        return {
          type: 'postgresql',
          tables: stats,
          total_records: Object.values(stats).reduce((sum, count) => sum + count, 0)
        };
      }
      
      // Fallback for other database types
      return {
        type: this.isSupabase ? 'supabase' : 'unknown',
        message: 'Statistics not available'
      };
    } catch (error) {
      return {
        error: error.message,
        type: this.isPostgreSQL ? 'postgresql' : 'supabase'
      };
    }
  }

  // ========================================
  // USER AUTHENTICATION METHODS
  // ========================================

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        'SELECT * FROM auto_alert.auto_alert_user_profiles WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_user_profiles')
        .select('*')
        .eq('email', email)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Get user by ID
   */
  async getUserById(id) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        'SELECT * FROM auto_alert.auto_alert_user_profiles WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_user_profiles')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, updates) {
    if (this.isPostgreSQL) {
      const setClause = Object.keys(updates).map((key, index) => 
        `${key} = $${index + 2}`
      ).join(', ');
      
      const result = await this.query(
        `UPDATE auto_alert.auto_alert_user_profiles 
         SET ${setClause}, updated_at = NOW() 
         WHERE id = $1 
         RETURNING *`,
        [userId, ...Object.values(updates)]
      );
      return result.rows[0];
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Update user last login
   */
  async updateUserLastLogin(userId) {
    const now = new Date().toISOString();
    
    if (this.isPostgreSQL) {
      await this.query(
        'UPDATE auto_alert.auto_alert_user_profiles SET last_login = $1 WHERE id = $2',
        [now, userId]
      );
    }
    else if (this.isSupabase) {
      await this.supabase
        .from('auto_alert_user_profiles')
        .update({ last_login: now })
        .eq('id', userId);
    }
  }

  // ========================================
  // SEARCH ALERTS METHODS
  // ========================================

  /**
   * Create search alert
   */
  async createSearchAlert(alertData) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        `INSERT INTO auto_alert.auto_alert_search_criteria 
         (user_id, name, criteria, notification_channels, is_active) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [
          alertData.userId,
          alertData.name,
          JSON.stringify(alertData.criteria),
          JSON.stringify(alertData.notificationChannels),
          alertData.isActive
        ]
      );
      return result.rows[0];
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_search_criteria')
        .insert({
          user_id: alertData.userId,
          name: alertData.name,
          criteria: alertData.criteria,
          notification_channels: alertData.notificationChannels,
          is_active: alertData.isActive
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Get user's search alerts
   */
  async getUserSearchAlerts(options) {
    const { userId, limit = 20, offset = 0, active } = options;
    
    if (this.isPostgreSQL) {
      let whereClause = 'WHERE user_id = $1';
      let params = [userId];
      
      if (active !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(active);
      }
      
      const alertsQuery = `
        SELECT *, 
               (SELECT COUNT(*) FROM auto_alert.auto_alert_found_vehicles 
                WHERE alert_id = auto_alert_search_criteria.id) as found_vehicles_count
        FROM auto_alert.auto_alert_search_criteria 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM auto_alert.auto_alert_search_criteria 
        ${whereClause}
      `;
      
      const [alertsResult, countResult] = await Promise.all([
        this.query(alertsQuery, [...params, limit, offset]),
        this.query(countQuery, params.slice(0, -2))
      ]);
      
      return {
        alerts: alertsResult.rows,
        total: parseInt(countResult.rows[0].total)
      };
    }
    else if (this.isSupabase) {
      let query = this.supabase
        .from('auto_alert_search_criteria')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (active !== undefined) {
        query = query.eq('is_active', active);
      }
      
      const { data: alerts, error: alertsError, count } = await query;
      
      if (alertsError) throw alertsError;
      
      return {
        alerts: alerts || [],
        total: count || 0
      };
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Get search alert by ID
   */
  async getSearchAlertById(alertId, userId) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        'SELECT * FROM auto_alert.auto_alert_search_criteria WHERE id = $1 AND user_id = $2',
        [alertId, userId]
      );
      return result.rows[0] || null;
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_search_criteria')
        .select('*')
        .eq('id', alertId)
        .eq('user_id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Update search alert
   */
  async updateSearchAlert(alertId, updates) {
    if (this.isPostgreSQL) {
      const setClause = Object.keys(updates).map((key, index) => {
        if (key === 'criteria' || key === 'notificationChannels') {
          return `${key === 'notificationChannels' ? 'notification_channels' : key} = $${index + 2}`;
        }
        return `${key === 'isActive' ? 'is_active' : key} = $${index + 2}`;
      }).join(', ');
      
      const values = Object.values(updates).map(value => {
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      });
      
      const result = await this.query(
        `UPDATE auto_alert.auto_alert_search_criteria 
         SET ${setClause}, updated_at = NOW() 
         WHERE id = $1 
         RETURNING *`,
        [alertId, ...values]
      );
      return result.rows[0];
    }
    else if (this.isSupabase) {
      const supabaseUpdates = {};
      
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'notificationChannels') {
          supabaseUpdates.notification_channels = value;
        } else if (key === 'isActive') {
          supabaseUpdates.is_active = value;
        } else {
          supabaseUpdates[key] = value;
        }
      });
      
      const { data, error } = await this.supabase
        .from('auto_alert_search_criteria')
        .update({ ...supabaseUpdates, updated_at: new Date().toISOString() })
        .eq('id', alertId)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Delete search alert
   */
  async deleteSearchAlert(alertId) {
    if (this.isPostgreSQL) {
      // Delete associated found vehicles first
      await this.query(
        'DELETE FROM auto_alert.auto_alert_found_vehicles WHERE alert_id = $1',
        [alertId]
      );
      
      // Delete the alert
      await this.query(
        'DELETE FROM auto_alert.auto_alert_search_criteria WHERE id = $1',
        [alertId]
      );
    }
    else if (this.isSupabase) {
      // Delete associated found vehicles first
      await this.supabase
        .from('auto_alert_found_vehicles')
        .delete()
        .eq('alert_id', alertId);
      
      // Delete the alert
      const { error } = await this.supabase
        .from('auto_alert_search_criteria')
        .delete()
        .eq('id', alertId);
        
      if (error) throw error;
    }
    else {
      throw new Error('No database connection available');
    }
  }

  /**
   * Get found vehicles for an alert
   */
  async getFoundVehiclesByAlert(alertId, limit = 10) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        'SELECT * FROM auto_alert.auto_alert_found_vehicles WHERE alert_id = $1 ORDER BY found_at DESC LIMIT $2',
        [alertId, limit]
      );
      return result.rows;
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_found_vehicles')
        .select('*')
        .eq('alert_id', alertId)
        .order('found_at', { ascending: false })
        .limit(limit);
        
      if (error) throw error;
      return data || [];
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Save found vehicle
   */
  async saveFoundVehicle(vehicleData) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        `INSERT INTO auto_alert.auto_alert_found_vehicles 
         (alert_id, title, price, year, mileage, location, image_url, mobile_de_url, vehicle_data) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [
          vehicleData.alertId,
          vehicleData.title,
          vehicleData.price,
          vehicleData.year,
          vehicleData.mileage,
          vehicleData.location,
          vehicleData.imageUrl,
          vehicleData.mobileDeUrl,
          JSON.stringify(vehicleData)
        ]
      );
      return result.rows[0];
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_found_vehicles')
        .insert({
          alert_id: vehicleData.alertId,
          title: vehicleData.title,
          price: vehicleData.price,
          year: vehicleData.year,
          mileage: vehicleData.mileage,
          location: vehicleData.location,
          image_url: vehicleData.imageUrl,
          mobile_de_url: vehicleData.mobileDeUrl,
          vehicle_data: vehicleData
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Filter new vehicles (not already saved)
   */
  async filterNewVehicles(alertId, vehicles) {
    if (!vehicles || vehicles.length === 0) return [];
    
    // Get URLs of already saved vehicles
    let existingUrls = [];
    
    if (this.isPostgreSQL) {
      const result = await this.query(
        'SELECT mobile_de_url FROM auto_alert.auto_alert_found_vehicles WHERE alert_id = $1',
        [alertId]
      );
      existingUrls = result.rows.map(row => row.mobile_de_url);
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_found_vehicles')
        .select('mobile_de_url')
        .eq('alert_id', alertId);
        
      if (error) throw error;
      existingUrls = (data || []).map(row => row.mobile_de_url);
    }
    
    // Filter out vehicles we've already seen
    return vehicles.filter(vehicle => 
      !existingUrls.includes(vehicle.mobileDeUrl || vehicle.url)
    );
  }

  /**
   * Update alert last run timestamp
   */
  async updateAlertLastRun(alertId) {
    const now = new Date().toISOString();
    
    if (this.isPostgreSQL) {
      await this.query(
        'UPDATE auto_alert.auto_alert_search_criteria SET last_run = $1 WHERE id = $2',
        [now, alertId]
      );
    }
    else if (this.isSupabase) {
      await this.supabase
        .from('auto_alert_search_criteria')
        .update({ last_run: now })
        .eq('id', alertId);
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(alertId) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        `SELECT 
           COUNT(*) as total_vehicles_found,
           AVG(price) as average_price,
           MIN(price) as min_price,
           MAX(price) as max_price,
           COUNT(DISTINCT vehicle_data->>'make') as unique_makes
         FROM auto_alert.auto_alert_found_vehicles 
         WHERE alert_id = $1 AND price > 0`,
        [alertId]
      );
      
      const stats = result.rows[0];
      return {
        totalVehiclesFound: parseInt(stats.total_vehicles_found) || 0,
        averagePrice: parseFloat(stats.average_price) || 0,
        priceRange: {
          min: parseFloat(stats.min_price) || 0,
          max: parseFloat(stats.max_price) || 0
        },
        uniqueMakes: parseInt(stats.unique_makes) || 0,
        searchRuns: 0, // TODO: Track search runs
        notificationsSent: 0 // TODO: Track notifications
      };
    }
    
    // Fallback for Supabase - simplified stats
    return {
      totalVehiclesFound: 0,
      averagePrice: 0,
      priceRange: { min: 0, max: 0 },
      uniqueMakes: 0,
      searchRuns: 0,
      notificationsSent: 0
    };
  }

  // ========================================
  // SUBSCRIPTION METHODS
  // ========================================

  /**
   * Get user subscription
   */
  async getUserSubscription(userId) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        'SELECT * FROM auto_alert.auto_alert_subscriptions WHERE user_id = $1 AND status IN (\'active\', \'past_due\')',
        [userId]
      );
      return result.rows[0] || null;
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'past_due'])
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
    
    return null; // No database connection - assume free tier
  }

  /**
   * Create subscription
   */
  async createSubscription(subscriptionData) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        `INSERT INTO auto_alert.auto_alert_subscriptions 
         (user_id, tier, status, current_period_start, current_period_end, payment_method_id, billing_address) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [
          subscriptionData.userId,
          subscriptionData.tier,
          subscriptionData.status,
          subscriptionData.currentPeriodStart,
          subscriptionData.currentPeriodEnd,
          subscriptionData.paymentMethodId,
          JSON.stringify(subscriptionData.billingAddress)
        ]
      );
      return result.rows[0];
    }
    else if (this.isSupabase) {
      const { data, error } = await this.supabase
        .from('auto_alert_subscriptions')
        .insert({
          user_id: subscriptionData.userId,
          tier: subscriptionData.tier,
          status: subscriptionData.status,
          current_period_start: subscriptionData.currentPeriodStart,
          current_period_end: subscriptionData.currentPeriodEnd,
          payment_method_id: subscriptionData.paymentMethodId,
          billing_address: subscriptionData.billingAddress
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscriptionId, updates) {
    if (this.isPostgreSQL) {
      const setClause = Object.keys(updates).map((key, index) => {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        return `${dbKey} = $${index + 2}`;
      }).join(', ');
      
      const values = Object.values(updates).map(value => {
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      });
      
      const result = await this.query(
        `UPDATE auto_alert.auto_alert_subscriptions 
         SET ${setClause}, updated_at = NOW() 
         WHERE id = $1 
         RETURNING *`,
        [subscriptionId, ...values]
      );
      return result.rows[0];
    }
    else if (this.isSupabase) {
      const supabaseUpdates = {};
      
      Object.entries(updates).forEach(([key, value]) => {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        supabaseUpdates[dbKey] = value;
      });
      
      const { data, error } = await this.supabase
        .from('auto_alert_subscriptions')
        .update({ ...supabaseUpdates, updated_at: new Date().toISOString() })
        .eq('id', subscriptionId)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
    
    throw new Error('No database connection available');
  }

  /**
   * Get user active alerts count
   */
  async getUserActiveAlertsCount(userId) {
    if (this.isPostgreSQL) {
      const result = await this.query(
        'SELECT COUNT(*) as count FROM auto_alert.auto_alert_search_criteria WHERE user_id = $1 AND is_active = true',
        [userId]
      );
      return parseInt(result.rows[0].count);
    }
    else if (this.isSupabase) {
      const { count, error } = await this.supabase
        .from('auto_alert_search_criteria')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);
        
      if (error) throw error;
      return count || 0;
    }
    
    return 0;
  }

  /**
   * Get user usage statistics
   */
  async getUserUsageStats(userId) {
    const activeAlerts = await this.getUserActiveAlertsCount(userId);
    
    // For now, return basic stats
    // In production, you'd track searches, notifications, etc.
    return {
      activeAlerts,
      searchesThisMonth: 0,
      notificationsThisMonth: 0,
      lastSearchRun: null,
      storageUsed: 0,
      apiCallsThisMonth: 0
    };
  }

  /**
   * Log subscription event
   */
  async logSubscriptionEvent(eventData) {
    // For now, just log to console
    // In production, you'd save to a subscription_events table
    console.log('Subscription event:', eventData);
  }

  /**
   * Get user billing history
   */
  async getUserBillingHistory(options) {
    // For now, return empty history
    // In production, you'd have a billing_history table
    return {
      records: [],
      total: 0
    };
  }

  /**
   * Close database connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 PostgreSQL connection closed');
    }
  }
}

// Export singleton instance
module.exports = new DatabaseService();