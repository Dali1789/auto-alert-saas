// Redis Configuration and Data Models for Auto-Alert System
// High-performance caching and session management

const redis = require('redis');

class RedisConfig {
    constructor() {
        this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = null;
        this.subscriber = null;
        this.publisher = null;
        
        // Cache TTL configurations (in seconds)
        this.ttl = {
            USER_SESSION: 24 * 60 * 60, // 24 hours
            USER_PROFILE: 30 * 60,      // 30 minutes
            SEARCH_RESULTS: 5 * 60,     // 5 minutes
            VEHICLE_DATA: 15 * 60,      // 15 minutes
            RATE_LIMIT: 60 * 60,        // 1 hour
            NOTIFICATION_QUEUE: 7 * 24 * 60 * 60, // 7 days
            METRICS: 5 * 60,            // 5 minutes
            MOBILE_DE_API: 10 * 60,     // 10 minutes
            IMAGE_CACHE: 60 * 60,       // 1 hour
            EXPORT_DATA: 30 * 60        // 30 minutes
        };
        
        // Key prefixes for organization
        this.prefixes = {
            SESSION: 'session:',
            USER: 'user:',
            SEARCH: 'search:',
            RESULT: 'result:',
            NOTIFICATION: 'notification:',
            RATE_LIMIT: 'rate_limit:',
            QUEUE: 'queue:',
            LOCK: 'lock:',
            METRICS: 'metrics:',
            CACHE: 'cache:',
            TEMP: 'temp:'
        };
    }

    async connect() {
        try {
            // Main client for general operations
            this.client = redis.createClient({
                url: this.redisUrl,
                socket: {
                    connectTimeout: 5000,
                    lazyConnect: true,
                },
                retry_strategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                }
            });

            // Separate client for pub/sub
            this.subscriber = this.client.duplicate();
            this.publisher = this.client.duplicate();

            // Event handlers
            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
            });

            this.client.on('connect', () => {
                console.log('Redis Client Connected');
            });

            this.client.on('ready', () => {
                console.log('Redis Client Ready');
            });

            this.client.on('end', () => {
                console.log('Redis Client Disconnected');
            });

            // Connect all clients
            await Promise.all([
                this.client.connect(),
                this.subscriber.connect(),
                this.publisher.connect()
            ]);

            return true;
        } catch (error) {
            console.error('Redis Connection Error:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            await Promise.all([
                this.client?.quit(),
                this.subscriber?.quit(),
                this.publisher?.quit()
            ]);
        } catch (error) {
            console.error('Redis Disconnect Error:', error);
        }
    }

    // User Session Management
    async setUserSession(userId, sessionData, ttl = this.ttl.USER_SESSION) {
        const key = `${this.prefixes.SESSION}${userId}`;
        await this.client.setEx(key, ttl, JSON.stringify(sessionData));
    }

    async getUserSession(userId) {
        const key = `${this.prefixes.SESSION}${userId}`;
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async deleteUserSession(userId) {
        const key = `${this.prefixes.SESSION}${userId}`;
        await this.client.del(key);
    }

    // User Profile Caching
    async cacheUserProfile(userId, profileData, ttl = this.ttl.USER_PROFILE) {
        const key = `${this.prefixes.USER}profile:${userId}`;
        await this.client.setEx(key, ttl, JSON.stringify(profileData));
    }

    async getUserProfile(userId) {
        const key = `${this.prefixes.USER}profile:${userId}`;
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async invalidateUserProfile(userId) {
        const pattern = `${this.prefixes.USER}*:${userId}`;
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(keys);
        }
    }

    // Search Results Caching
    async cacheSearchResults(searchHash, results, ttl = this.ttl.SEARCH_RESULTS) {
        const key = `${this.prefixes.SEARCH}results:${searchHash}`;
        await this.client.setEx(key, ttl, JSON.stringify(results));
    }

    async getSearchResults(searchHash) {
        const key = `${this.prefixes.SEARCH}results:${searchHash}`;
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async invalidateSearchResults(searchId) {
        const pattern = `${this.prefixes.SEARCH}*${searchId}*`;
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(keys);
        }
    }

    // Vehicle Data Caching
    async cacheVehicleData(mobileAdId, vehicleData, ttl = this.ttl.VEHICLE_DATA) {
        const key = `${this.prefixes.RESULT}vehicle:${mobileAdId}`;
        await this.client.setEx(key, ttl, JSON.stringify(vehicleData));
    }

    async getVehicleData(mobileAdId) {
        const key = `${this.prefixes.RESULT}vehicle:${mobileAdId}`;
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    // Rate Limiting
    async checkRateLimit(identifier, limit, windowSeconds = 3600) {
        const key = `${this.prefixes.RATE_LIMIT}${identifier}`;
        const current = await this.client.incr(key);
        
        if (current === 1) {
            await this.client.expire(key, windowSeconds);
        }
        
        return {
            allowed: current <= limit,
            count: current,
            remaining: Math.max(0, limit - current),
            resetTime: await this.client.ttl(key)
        };
    }

    // Notification Queue Management
    async queueNotification(notificationData) {
        const queueKey = `${this.prefixes.QUEUE}notifications`;
        const priority = notificationData.priority || 0;
        const score = Date.now() + (priority * 1000); // Higher priority = lower score
        
        await this.client.zAdd(queueKey, {
            score: score,
            value: JSON.stringify(notificationData)
        });
    }

    async dequeueNotification() {
        const queueKey = `${this.prefixes.QUEUE}notifications`;
        const result = await this.client.zPopMin(queueKey);
        
        if (result) {
            return JSON.parse(result.value);
        }
        return null;
    }

    async getQueueLength() {
        const queueKey = `${this.prefixes.QUEUE}notifications`;
        return await this.client.zCard(queueKey);
    }

    // Distributed Locking
    async acquireLock(lockKey, ttl = 30, timeout = 10000) {
        const key = `${this.prefixes.LOCK}${lockKey}`;
        const identifier = `${Date.now()}-${Math.random()}`;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const result = await this.client.set(key, identifier, {
                EX: ttl,
                NX: true
            });

            if (result === 'OK') {
                return identifier;
            }

            await new Promise(resolve => setTimeout(resolve, 10));
        }

        throw new Error(`Could not acquire lock: ${lockKey}`);
    }

    async releaseLock(lockKey, identifier) {
        const key = `${this.prefixes.LOCK}${lockKey}`;
        const script = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            else
                return 0
            end
        `;
        
        return await this.client.eval(script, {
            keys: [key],
            arguments: [identifier]
        });
    }

    // Metrics and Analytics
    async recordMetric(metricName, value, timestamp = null) {
        const ts = timestamp || Date.now();
        const key = `${this.prefixes.METRICS}${metricName}`;
        
        // Store as time series data
        await this.client.zAdd(key, {
            score: ts,
            value: JSON.stringify({ value, timestamp: ts })
        });

        // Keep only last 24 hours
        const cutoff = ts - (24 * 60 * 60 * 1000);
        await this.client.zRemRangeByScore(key, 0, cutoff);
    }

    async getMetrics(metricName, fromTime = null, toTime = null) {
        const key = `${this.prefixes.METRICS}${metricName}`;
        const from = fromTime || (Date.now() - (60 * 60 * 1000)); // Last hour
        const to = toTime || Date.now();
        
        const results = await this.client.zRangeByScore(key, from, to);
        return results.map(r => JSON.parse(r));
    }

    // Pub/Sub for Real-time Events
    async publishEvent(channel, eventData) {
        await this.publisher.publish(channel, JSON.stringify(eventData));
    }

    async subscribeToChannel(channel, callback) {
        await this.subscriber.subscribe(channel, (message) => {
            try {
                const eventData = JSON.parse(message);
                callback(eventData);
            } catch (error) {
                console.error('Error parsing pub/sub message:', error);
            }
        });
    }

    // Bulk Operations
    async mget(keys) {
        if (keys.length === 0) return [];
        const values = await this.client.mGet(keys);
        return values.map(v => v ? JSON.parse(v) : null);
    }

    async mset(keyValuePairs, ttl = null) {
        const pipeline = this.client.multi();
        
        for (const [key, value] of keyValuePairs) {
            if (ttl) {
                pipeline.setEx(key, ttl, JSON.stringify(value));
            } else {
                pipeline.set(key, JSON.stringify(value));
            }
        }
        
        await pipeline.exec();
    }

    // Cache Invalidation Patterns
    async invalidatePattern(pattern) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(keys);
        }
        return keys.length;
    }

    // Health Check
    async healthCheck() {
        try {
            const start = Date.now();
            await this.client.ping();
            const latency = Date.now() - start;
            
            const info = await this.client.info('memory');
            const memoryInfo = {};
            info.split('\r\n').forEach(line => {
                const [key, value] = line.split(':');
                if (key && value) {
                    memoryInfo[key] = value;
                }
            });

            return {
                status: 'healthy',
                latency: `${latency}ms`,
                memory: memoryInfo,
                connected: this.client.isReady
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    // Cache Statistics
    async getCacheStats() {
        const info = await this.client.info('stats');
        const stats = {};
        
        info.split('\r\n').forEach(line => {
            const [key, value] = line.split(':');
            if (key && value) {
                stats[key] = value;
            }
        });

        return stats;
    }
}

// Cache Strategy Implementations
class CacheStrategies {
    constructor(redisConfig) {
        this.redis = redisConfig;
    }

    // Write-Through Cache
    async writeThrough(key, data, dbWriteFunction, ttl) {
        // Write to database first
        const result = await dbWriteFunction(data);
        
        // Then cache the result
        await this.redis.client.setEx(key, ttl, JSON.stringify(result));
        
        return result;
    }

    // Write-Behind Cache (Write-Back)
    async writeBehind(key, data, ttl) {
        // Cache immediately
        await this.redis.client.setEx(key, ttl, JSON.stringify(data));
        
        // Queue for background database write
        await this.redis.queueNotification({
            type: 'write_behind',
            key: key,
            data: data,
            priority: 1
        });
        
        return data;
    }

    // Cache-Aside Pattern
    async cacheAside(key, dbReadFunction, ttl) {
        // Try cache first
        const cached = await this.redis.client.get(key);
        if (cached) {
            return JSON.parse(cached);
        }
        
        // Load from database
        const data = await dbReadFunction();
        if (data) {
            // Cache for next time
            await this.redis.client.setEx(key, ttl, JSON.stringify(data));
        }
        
        return data;
    }
}

module.exports = {
    RedisConfig,
    CacheStrategies
};