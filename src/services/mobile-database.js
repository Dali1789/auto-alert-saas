/**
 * Database service extensions for Mobile.de scraper
 * Specialized database operations for vehicle data and search management
 */

const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');
const { VehicleDataProcessor, DeduplicationHelper } = require('../utils/scraper-helpers');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/mobile-database.log' }),
    new winston.transports.Console()
  ]
});

class MobileDatabaseService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    this.batchSize = 100;
    this.maxRetries = 3;
  }

  /**
   * Create or update a search record
   */
  async createSearch(searchData) {
    try {
      const { data, error } = await this.supabase
        .from('searches')
        .insert({
          user_id: searchData.user_id,
          name: searchData.name,
          search_params: searchData.search_params,
          is_active: searchData.is_active || true,
          priority: searchData.priority || 'medium',
          notification_enabled: searchData.notification_enabled !== false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`Search created: ${data.id}`);
      return data;

    } catch (error) {
      logger.error('Failed to create search:', error);
      throw error;
    }
  }

  /**
   * Get active searches with optional priority filter
   */
  async getActiveSearches(priority = null) {
    try {
      let query = this.supabase
        .from('searches')
        .select(`
          *,
          users:user_id (
            id,
            email,
            notification_enabled,
            notification_preferences,
            email_notifications,
            push_notifications,
            webhook_url
          )
        `)
        .eq('is_active', true);

      if (priority) {
        query = query.eq('priority', priority);
      }

      const { data, error } = await query.order('last_checked_at', { ascending: true });

      if (error) throw error;

      return data || [];

    } catch (error) {
      logger.error('Failed to get active searches:', error);
      throw error;
    }
  }

  /**
   * Get searches for a specific user
   */
  async getUserSearches(userId) {
    try {
      const { data, error } = await this.supabase
        .from('searches')
        .select(`
          *,
          search_stats:search_id (
            total_results_found,
            new_results_found,
            last_new_result_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];

    } catch (error) {
      logger.error('Failed to get user searches:', error);
      throw error;
    }
  }

  /**
   * Update search last checked time and stats
   */
  async updateSearchStats(searchId, stats) {
    try {
      const { error } = await this.supabase
        .from('searches')
        .update({
          last_checked_at: stats.last_checked_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', searchId);

      if (error) throw error;

      // Update or insert search stats
      const { error: statsError } = await this.supabase
        .from('search_stats')
        .upsert({
          search_id: searchId,
          total_results_found: stats.total_results_found,
          new_results_found: stats.new_results_found,
          last_new_result_at: stats.last_new_result_at,
          updated_at: new Date().toISOString()
        });

      if (statsError) throw statsError;

      logger.info(`Search stats updated: ${searchId}`);

    } catch (error) {
      logger.error('Failed to update search stats:', error);
      throw error;
    }
  }

  /**
   * Store vehicle data with deduplication
   */
  async createVehicle(vehicleData) {
    try {
      // Normalize vehicle data
      const normalized = VehicleDataProcessor.normalizeVehicle(vehicleData);

      // Check for existing vehicle by URL
      const existing = await this.getVehicleByUrl(normalized.url);
      if (existing) {
        return await this.updateVehicle(existing.id, {
          ...normalized,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Create new vehicle record
      const { data, error } = await this.supabase
        .from('vehicles')
        .insert({
          ...normalized,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`Vehicle created: ${data.id} (${normalized.title})`);
      return data;

    } catch (error) {
      logger.error('Failed to create vehicle:', error);
      throw error;
    }
  }

  /**
   * Update existing vehicle
   */
  async updateVehicle(vehicleId, updateData) {
    try {
      const { data, error } = await this.supabase
        .from('vehicles')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', vehicleId)
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      logger.error('Failed to update vehicle:', error);
      throw error;
    }
  }

  /**
   * Get vehicle by URL
   */
  async getVehicleByUrl(url) {
    try {
      const { data, error } = await this.supabase
        .from('vehicles')
        .select('*')
        .eq('url', url)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data;

    } catch (error) {
      logger.error('Failed to get vehicle by URL:', error);
      throw error;
    }
  }

  /**
   * Get vehicle by ID
   */
  async getVehicleById(vehicleId) {
    try {
      const { data, error } = await this.supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      logger.error('Failed to get vehicle by ID:', error);
      throw error;
    }
  }

  /**
   * Batch store vehicles with deduplication
   */
  async batchCreateVehicles(vehicles, searchId) {
    const results = {
      created: 0,
      updated: 0,
      duplicates: 0,
      errors: 0
    };

    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < vehicles.length; i += this.batchSize) {
      const batch = vehicles.slice(i, i + this.batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (vehicle) => {
          try {
            // Check for duplicates within the batch first
            const isDuplicate = await this.isDuplicateVehicle(vehicle);
            if (isDuplicate) {
              results.duplicates++;
              return null;
            }

            const stored = await this.createVehicle({
              ...vehicle,
              search_id: searchId
            });

            if (stored.created_at === stored.updated_at) {
              results.created++;
            } else {
              results.updated++;
            }

            return stored;

          } catch (error) {
            logger.warn(`Failed to store vehicle ${vehicle.url}:`, error.message);
            results.errors++;
            return null;
          }
        })
      );

      // Small delay between batches
      if (i + this.batchSize < vehicles.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info(`Batch vehicle storage completed:`, results);
    return results;
  }

  /**
   * Check if vehicle is duplicate
   */
  async isDuplicateVehicle(vehicle) {
    try {
      // First check by URL (exact match)
      const existing = await this.getVehicleByUrl(vehicle.url);
      if (existing) {
        return true;
      }

      // Then check by content hash for potential duplicates
      const contentHash = DeduplicationHelper.generateVehicleHash(vehicle);
      
      const { data, error } = await this.supabase
        .from('vehicles')
        .select('*')
        .eq('content_hash', contentHash)
        .limit(5);

      if (error) throw error;

      if (data && data.length > 0) {
        // Check for true duplicates using similarity
        for (const existingVehicle of data) {
          if (DeduplicationHelper.areVehiclesDuplicate(vehicle, existingVehicle)) {
            return true;
          }
        }
      }

      return false;

    } catch (error) {
      logger.warn('Error checking for duplicate vehicle:', error);
      return false; // Don't block on error
    }
  }

  /**
   * Link vehicle to search (for tracking which searches found which vehicles)
   */
  async addVehicleToSearch(vehicleId, searchId) {
    try {
      const { error } = await this.supabase
        .from('vehicle_search_results')
        .upsert({
          vehicle_id: vehicleId,
          search_id: searchId,
          found_at: new Date().toISOString()
        });

      if (error) throw error;

      logger.info(`Vehicle ${vehicleId} linked to search ${searchId}`);

    } catch (error) {
      logger.error('Failed to link vehicle to search:', error);
      throw error;
    }
  }

  /**
   * Check if vehicle has been seen in a specific search
   */
  async hasVehicleBeenSeenInSearch(vehicleId, searchId) {
    try {
      const { data, error } = await this.supabase
        .from('vehicle_search_results')
        .select('id')
        .eq('vehicle_id', vehicleId)
        .eq('search_id', searchId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return !!data;

    } catch (error) {
      logger.error('Failed to check vehicle search history:', error);
      return false;
    }
  }

  /**
   * Get recent vehicles for a search
   */
  async getRecentVehiclesForSearch(searchId, limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from('vehicle_search_results')
        .select(`
          found_at,
          vehicles:vehicle_id (
            *
          )
        `)
        .eq('search_id', searchId)
        .order('found_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data?.map(item => ({
        ...item.vehicles,
        foundAt: item.found_at
      })) || [];

    } catch (error) {
      logger.error('Failed to get recent vehicles for search:', error);
      throw error;
    }
  }

  /**
   * Clean up old vehicle records
   */
  async deleteOldVehicles(cutoffDate) {
    try {
      const { data, error } = await this.supabase
        .from('vehicles')
        .delete()
        .lt('last_seen_at', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;

      const deletedCount = data?.length || 0;
      logger.info(`Deleted ${deletedCount} old vehicle records`);

      return deletedCount;

    } catch (error) {
      logger.error('Failed to delete old vehicles:', error);
      throw error;
    }
  }

  /**
   * Clean up old search results
   */
  async deleteOldSearchResults(cutoffDate) {
    try {
      const { data, error } = await this.supabase
        .from('vehicle_search_results')
        .delete()
        .lt('found_at', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;

      const deletedCount = data?.length || 0;
      logger.info(`Deleted ${deletedCount} old search results`);

      return deletedCount;

    } catch (error) {
      logger.error('Failed to delete old search results:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getSearchStats() {
    try {
      const [
        { count: totalSearches },
        { count: activeSearches },
        { count: totalVehicles },
        { count: recentVehicles }
      ] = await Promise.all([
        this.supabase.from('searches').select('id', { count: 'exact', head: true }),
        this.supabase.from('searches').select('id', { count: 'exact', head: true }).eq('is_active', true),
        this.supabase.from('vehicles').select('id', { count: 'exact', head: true }),
        this.supabase.from('vehicles').select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      return {
        totalSearches: totalSearches || 0,
        activeSearches: activeSearches || 0,
        totalVehicles: totalVehicles || 0,
        recentVehicles: recentVehicles || 0
      };

    } catch (error) {
      logger.error('Failed to get search stats:', error);
      return {
        totalSearches: 0,
        activeSearches: 0,
        totalVehicles: 0,
        recentVehicles: 0
      };
    }
  }

  /**
   * Update search with error information
   */
  async updateSearchError(searchId, errorMessage) {
    try {
      const { error } = await this.supabase
        .from('searches')
        .update({
          last_error: errorMessage,
          last_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', searchId);

      if (error) throw error;

    } catch (error) {
      logger.error('Failed to update search error:', error);
    }
  }

  /**
   * Get user by ID with notification preferences
   */
  async getUserById(userId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select(`
          id,
          email,
          notification_enabled,
          notification_preferences,
          email_notifications,
          push_notifications,
          webhook_url
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      logger.error('Failed to get user:', error);
      throw error;
    }
  }

  /**
   * Get search by ID
   */
  async getSearchById(searchId) {
    try {
      const { data, error } = await this.supabase
        .from('searches')
        .select('*')
        .eq('id', searchId)
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      logger.error('Failed to get search by ID:', error);
      throw error;
    }
  }

  /**
   * Update search last checked time
   */
  async updateSearchLastChecked(searchId) {
    try {
      const { error } = await this.supabase
        .from('searches')
        .update({
          last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', searchId);

      if (error) throw error;

    } catch (error) {
      logger.error('Failed to update search last checked:', error);
      throw error;
    }
  }

  /**
   * Delete search
   */
  async deleteSearch(searchId) {
    try {
      const { error } = await this.supabase
        .from('searches')
        .delete()
        .eq('id', searchId);

      if (error) throw error;

      logger.info(`Search deleted: ${searchId}`);

    } catch (error) {
      logger.error('Failed to delete search:', error);
      throw error;
    }
  }

  /**
   * Update search
   */
  async updateSearch(searchId, updateData) {
    try {
      const { data, error } = await this.supabase
        .from('searches')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', searchId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Search updated: ${searchId}`);
      return data;

    } catch (error) {
      logger.error('Failed to update search:', error);
      throw error;
    }
  }
}

module.exports = MobileDatabaseService;