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