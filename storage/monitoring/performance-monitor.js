// Performance Monitoring Service for Auto-Alert Storage Infrastructure
// Real-time monitoring, alerting, and optimization recommendations

const { EventEmitter } = require('events');
const { performance } = require('perf_hooks');

class PerformanceMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enabled: config.enabled !== false,
            slowQueryThreshold: config.slowQueryThreshold || 1000, // ms
            metricsRetention: config.metricsRetention || 7 * 24 * 60 * 60 * 1000, // 7 days
            alertThresholds: {
                cpu: config.alertThresholds?.cpu || 80, // %
                memory: config.alertThresholds?.memory || 85, // %
                diskIO: config.alertThresholds?.diskIO || 90, // %
                queryTime: config.alertThresholds?.queryTime || 2000, // ms
                errorRate: config.alertThresholds?.errorRate || 5, // %
                cacheHitRate: config.alertThresholds?.cacheHitRate || 70 // %
            },
            samplingRate: config.samplingRate || 1.0, // 100% sampling
            batchSize: config.batchSize || 100,
            flushInterval: config.flushInterval || 30000, // 30 seconds
            ...config
        };

        this.metrics = new Map();
        this.queryHistory = [];
        this.systemMetrics = [];
        this.alerts = [];
        this.metricsBuffer = [];
        
        this.isCollecting = false;
        this.flushTimer = null;
        
        // Performance tracking objects
        this.activeQueries = new Map();
        this.performanceObserver = null;
        
        // Database connections (injected)
        this.db = null;
        this.redis = null;
    }

    async initialize(db, redis) {
        this.db = db;
        this.redis = redis;
        
        if (!this.config.enabled) {
            console.log('Performance monitoring disabled');
            return;
        }

        await this.setupMonitoring();
        this.startCollection();
        
        console.log('Performance Monitor initialized');
    }

    async setupMonitoring() {
        // Setup database query monitoring
        if (this.db) {
            this.setupDatabaseMonitoring();
        }

        // Setup Redis monitoring
        if (this.redis) {
            this.setupRedisMonitoring();
        }

        // Setup system metrics collection
        this.setupSystemMetricsCollection();
        
        // Setup periodic flush
        this.flushTimer = setInterval(() => {
            this.flushMetrics();
        }, this.config.flushInterval);
    }

    setupDatabaseMonitoring() {
        const originalQuery = this.db.query;
        const self = this;

        this.db.query = function(text, params, callback) {
            const queryId = `query_${Date.now()}_${Math.random()}`;
            const startTime = performance.now();
            
            // Track active query
            self.activeQueries.set(queryId, {
                text,
                params,
                startTime,
                type: self.getQueryType(text)
            });

            const finish = (error, result) => {
                const endTime = performance.now();
                const executionTime = endTime - startTime;
                
                self.recordQueryMetrics({
                    queryId,
                    text,
                    params,
                    executionTime,
                    error,
                    result,
                    startTime: new Date(Date.now() - executionTime)
                });
                
                self.activeQueries.delete(queryId);
            };

            if (callback) {
                // Callback style
                return originalQuery.call(this, text, params, (error, result) => {
                    finish(error, result);
                    callback(error, result);
                });
            } else {
                // Promise style
                const promise = originalQuery.call(this, text, params);
                
                if (promise && promise.then) {
                    return promise
                        .then(result => {
                            finish(null, result);
                            return result;
                        })
                        .catch(error => {
                            finish(error, null);
                            throw error;
                        });
                }
                
                return promise;
            }
        };
    }

    setupRedisMonitoring() {
        const commands = ['get', 'set', 'del', 'exists', 'hget', 'hset', 'zadd', 'zrange'];
        
        commands.forEach(command => {
            const originalCommand = this.redis.client[command];
            if (typeof originalCommand === 'function') {
                this.redis.client[command] = (...args) => {
                    const startTime = performance.now();
                    const result = originalCommand.apply(this.redis.client, args);
                    
                    if (result && result.then) {
                        return result
                            .then(res => {
                                this.recordRedisMetrics(command, performance.now() - startTime, null, args);
                                return res;
                            })
                            .catch(error => {
                                this.recordRedisMetrics(command, performance.now() - startTime, error, args);
                                throw error;
                            });
                    }
                    
                    this.recordRedisMetrics(command, performance.now() - startTime, null, args);
                    return result;
                };
            }
        });
    }

    setupSystemMetricsCollection() {
        // Collect system metrics every 30 seconds
        setInterval(async () => {
            await this.collectSystemMetrics();
        }, 30000);
    }

    async collectSystemMetrics() {
        try {
            const metrics = {
                timestamp: new Date(),
                cpu: await this.getCPUUsage(),
                memory: await this.getMemoryUsage(),
                disk: await this.getDiskUsage(),
                network: await this.getNetworkStats(),
                database: await this.getDatabaseStats(),
                redis: await this.getRedisStats(),
                application: await this.getApplicationStats()
            };

            this.systemMetrics.push(metrics);
            this.checkAlertThresholds(metrics);
            
            // Keep only recent metrics
            const cutoff = Date.now() - this.config.metricsRetention;
            this.systemMetrics = this.systemMetrics.filter(m => m.timestamp.getTime() > cutoff);
            
        } catch (error) {
            console.error('Error collecting system metrics:', error);
        }
    }

    recordQueryMetrics(queryData) {
        const {
            queryId,
            text,
            params,
            executionTime,
            error,
            result,
            startTime
        } = queryData;

        const metrics = {
            id: queryId,
            queryHash: this.hashQuery(text),
            queryType: this.getQueryType(text),
            queryText: this.shouldSample() ? text : null,
            normalizedQuery: this.normalizeQuery(text),
            executionTimeMs: executionTime,
            rowsReturned: result?.rowCount || result?.rows?.length || 0,
            hasError: !!error,
            errorMessage: error?.message,
            timestamp: startTime,
            
            // Performance classification
            isSlowQuery: executionTime > this.config.slowQueryThreshold,
            isOptimizationCandidate: this.isOptimizationCandidate(text, executionTime)
        };

        this.queryHistory.push(metrics);
        this.metricsBuffer.push({
            type: 'query_performance',
            data: metrics
        });

        // Check for performance issues
        this.checkQueryPerformance(metrics);
        
        // Emit event for real-time monitoring
        this.emit('queryExecuted', metrics);
    }

    recordRedisMetrics(command, executionTime, error, args) {
        const metrics = {
            command,
            executionTimeMs: executionTime,
            hasError: !!error,
            errorMessage: error?.message,
            argsCount: args.length,
            timestamp: new Date()
        };

        this.metricsBuffer.push({
            type: 'redis_performance',
            data: metrics
        });

        this.emit('redisCommand', metrics);
    }

    async getCPUUsage() {
        // This would integrate with system monitoring tools
        // For now, return mock data
        return {
            usage: Math.random() * 100,
            loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2],
            cores: require('os').cpus().length
        };
    }

    async getMemoryUsage() {
        const usage = process.memoryUsage();
        const total = require('os').totalmem();
        const free = require('os').freemem();
        const used = total - free;

        return {
            processHeapUsed: usage.heapUsed,
            processHeapTotal: usage.heapTotal,
            processRSS: usage.rss,
            processExternal: usage.external,
            systemTotal: total,
            systemUsed: used,
            systemFree: free,
            systemUsagePercent: (used / total) * 100
        };
    }

    async getDiskUsage() {
        // This would integrate with disk monitoring
        return {
            usage: Math.random() * 100,
            free: Math.random() * 1000000000,
            total: 1000000000,
            iops: Math.random() * 1000
        };
    }

    async getNetworkStats() {
        return {
            bytesReceived: Math.random() * 1000000,
            bytesSent: Math.random() * 1000000,
            packetsReceived: Math.random() * 10000,
            packetsSent: Math.random() * 10000,
            errors: Math.random() * 10
        };
    }

    async getDatabaseStats() {
        if (!this.db) return null;

        try {
            const result = await this.db.query(`
                SELECT 
                    numbackends as active_connections,
                    xact_commit as transactions_committed,
                    xact_rollback as transactions_rolled_back,
                    blks_read as blocks_read,
                    blks_hit as blocks_hit,
                    tup_returned as tuples_returned,
                    tup_fetched as tuples_fetched,
                    tup_inserted as tuples_inserted,
                    tup_updated as tuples_updated,
                    tup_deleted as tuples_deleted
                FROM pg_stat_database 
                WHERE datname = current_database()
            `);

            const stats = result.rows[0];
            
            return {
                ...stats,
                cacheHitRatio: stats.blocks_hit / (stats.blocks_read + stats.blocks_hit) * 100
            };
        } catch (error) {
            console.error('Error getting database stats:', error);
            return null;
        }
    }

    async getRedisStats() {
        if (!this.redis) return null;

        try {
            const info = await this.redis.client.info();
            const stats = this.parseRedisInfo(info);
            
            return {
                connectedClients: parseInt(stats.connected_clients || 0),
                usedMemory: parseInt(stats.used_memory || 0),
                totalCommandsProcessed: parseInt(stats.total_commands_processed || 0),
                instantaneousOpsPerSec: parseInt(stats.instantaneous_ops_per_sec || 0),
                keyspaceHits: parseInt(stats.keyspace_hits || 0),
                keyspaceMisses: parseInt(stats.keyspace_misses || 0),
                hitRate: this.calculateRedisHitRate(stats)
            };
        } catch (error) {
            console.error('Error getting Redis stats:', error);
            return null;
        }
    }

    async getApplicationStats() {
        return {
            uptime: process.uptime(),
            nodeVersion: process.version,
            pid: process.pid,
            activeHandles: process._getActiveHandles().length,
            activeRequests: process._getActiveRequests().length,
            
            // Query statistics
            totalQueries: this.queryHistory.length,
            slowQueries: this.queryHistory.filter(q => q.isSlowQuery).length,
            averageQueryTime: this.calculateAverageQueryTime(),
            
            // Cache statistics
            activeConnections: this.activeQueries.size
        };
    }

    checkAlertThresholds(metrics) {
        const alerts = [];

        // CPU usage alert
        if (metrics.cpu.usage > this.config.alertThresholds.cpu) {
            alerts.push({
                type: 'cpu_high',
                severity: 'warning',
                message: `CPU usage is ${metrics.cpu.usage.toFixed(1)}%`,
                threshold: this.config.alertThresholds.cpu,
                value: metrics.cpu.usage,
                timestamp: new Date()
            });
        }

        // Memory usage alert
        if (metrics.memory.systemUsagePercent > this.config.alertThresholds.memory) {
            alerts.push({
                type: 'memory_high',
                severity: 'warning',
                message: `Memory usage is ${metrics.memory.systemUsagePercent.toFixed(1)}%`,
                threshold: this.config.alertThresholds.memory,
                value: metrics.memory.systemUsagePercent,
                timestamp: new Date()
            });
        }

        // Database cache hit rate alert
        if (metrics.database && metrics.database.cacheHitRatio < this.config.alertThresholds.cacheHitRate) {
            alerts.push({
                type: 'low_cache_hit_rate',
                severity: 'warning',
                message: `Database cache hit rate is ${metrics.database.cacheHitRatio.toFixed(1)}%`,
                threshold: this.config.alertThresholds.cacheHitRate,
                value: metrics.database.cacheHitRatio,
                timestamp: new Date()
            });
        }

        // Process alerts
        for (const alert of alerts) {
            this.processAlert(alert);
        }
    }

    checkQueryPerformance(queryMetrics) {
        if (queryMetrics.isSlowQuery) {
            const alert = {
                type: 'slow_query',
                severity: 'warning',
                message: `Slow query detected: ${queryMetrics.executionTimeMs.toFixed(1)}ms`,
                queryHash: queryMetrics.queryHash,
                queryType: queryMetrics.queryType,
                executionTime: queryMetrics.executionTimeMs,
                threshold: this.config.slowQueryThreshold,
                timestamp: new Date()
            };
            
            this.processAlert(alert);
        }
    }

    processAlert(alert) {
        this.alerts.push(alert);
        
        // Emit alert event
        this.emit('alert', alert);
        
        // Log alert
        console.warn(`[ALERT] ${alert.type}: ${alert.message}`);
        
        // Keep only recent alerts
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);
    }

    async flushMetrics() {
        if (this.metricsBuffer.length === 0) {
            return;
        }

        const batch = this.metricsBuffer.splice(0, this.config.batchSize);
        
        try {
            await this.persistMetrics(batch);
        } catch (error) {
            console.error('Error flushing metrics:', error);
            // Put failed metrics back in buffer
            this.metricsBuffer.unshift(...batch);
        }
    }

    async persistMetrics(metrics) {
        if (!this.db) return;

        const queryMetrics = metrics.filter(m => m.type === 'query_performance');
        const systemMetrics = metrics.filter(m => m.type === 'system_metrics');
        const redisMetrics = metrics.filter(m => m.type === 'redis_performance');

        // Persist query metrics
        if (queryMetrics.length > 0) {
            await this.persistQueryMetrics(queryMetrics.map(m => m.data));
        }

        // Persist system metrics
        if (systemMetrics.length > 0) {
            await this.persistSystemMetrics(systemMetrics.map(m => m.data));
        }

        // Store Redis metrics in Redis itself for fast access
        if (redisMetrics.length > 0 && this.redis) {
            await this.persistRedisMetrics(redisMetrics.map(m => m.data));
        }
    }

    async persistQueryMetrics(metrics) {
        const values = metrics.map(m => [
            m.queryHash,
            m.queryType,
            m.queryText,
            m.normalizedQuery,
            m.executionTimeMs,
            m.rowsReturned,
            m.hasError,
            m.errorMessage,
            m.isSlowQuery,
            m.isOptimizationCandidate,
            m.timestamp
        ]);

        const query = `
            INSERT INTO monitoring.query_performance (
                query_hash, query_type, query_text, normalized_query,
                execution_time_ms, rows_returned, has_error, error_message,
                slow_query, optimization_candidate, executed_at
            ) VALUES ${values.map((_, i) => `($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4}, $${i * 11 + 5}, $${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8}, $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`).join(', ')}
        `;

        await this.db.query(query, values.flat());
    }

    async persistSystemMetrics(metrics) {
        const values = [];
        
        for (const metric of metrics) {
            // Flatten nested metrics
            const flatMetrics = this.flattenMetrics(metric);
            
            for (const [name, value] of Object.entries(flatMetrics)) {
                if (typeof value === 'number') {
                    values.push([
                        name,
                        'gauge',
                        value,
                        this.getMetricUnit(name),
                        'auto-alert',
                        'storage',
                        JSON.stringify({}),
                        metric.timestamp
                    ]);
                }
            }
        }

        if (values.length === 0) return;

        const query = `
            INSERT INTO monitoring.system_metrics (
                metric_name, metric_type, metric_value, metric_unit,
                service_name, component, tags, recorded_at
            ) VALUES ${values.map((_, i) => `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`).join(', ')}
        `;

        await this.db.query(query, values.flat());
    }

    async persistRedisMetrics(metrics) {
        for (const metric of metrics) {
            const key = `metrics:redis:${metric.command}:${Date.now()}`;
            await this.redis.client.setEx(key, 3600, JSON.stringify(metric)); // 1 hour TTL
        }
    }

    // Performance Analysis Methods
    async getSlowQueries(limit = 50) {
        if (!this.db) return [];

        const result = await this.db.query(`
            SELECT 
                query_hash,
                query_type,
                normalized_query,
                AVG(execution_time_ms) as avg_execution_time,
                COUNT(*) as execution_count,
                MAX(execution_time_ms) as max_execution_time,
                MIN(execution_time_ms) as min_execution_time
            FROM monitoring.query_performance
            WHERE slow_query = true
                AND executed_at > NOW() - INTERVAL '24 hours'
            GROUP BY query_hash, query_type, normalized_query
            ORDER BY avg_execution_time DESC
            LIMIT $1
        `, [limit]);

        return result.rows;
    }

    async getPerformanceTrends(hours = 24) {
        if (!this.db) return {};

        const result = await this.db.query(`
            SELECT 
                DATE_TRUNC('hour', executed_at) as hour,
                AVG(execution_time_ms) as avg_execution_time,
                COUNT(*) as query_count,
                COUNT(CASE WHEN slow_query THEN 1 END) as slow_query_count
            FROM monitoring.query_performance
            WHERE executed_at > NOW() - INTERVAL '${hours} hours'
            GROUP BY hour
            ORDER BY hour
        `);

        return result.rows;
    }

    async getSystemHealthSummary() {
        const currentMetrics = this.systemMetrics[this.systemMetrics.length - 1];
        const recentAlerts = this.alerts.filter(a => 
            a.timestamp.getTime() > Date.now() - (60 * 60 * 1000) // Last hour
        );

        return {
            status: recentAlerts.length === 0 ? 'healthy' : 'warning',
            timestamp: new Date(),
            metrics: currentMetrics,
            alerts: recentAlerts,
            summary: {
                totalQueries: this.queryHistory.length,
                slowQueries: this.queryHistory.filter(q => q.isSlowQuery).length,
                averageQueryTime: this.calculateAverageQueryTime(),
                activeConnections: this.activeQueries.size,
                alertsLastHour: recentAlerts.length
            }
        };
    }

    // Utility Methods
    shouldSample() {
        return Math.random() < this.config.samplingRate;
    }

    hashQuery(query) {
        return require('crypto').createHash('md5').update(query).digest('hex');
    }

    getQueryType(query) {
        const trimmed = query.trim().toUpperCase();
        if (trimmed.startsWith('SELECT')) return 'SELECT';
        if (trimmed.startsWith('INSERT')) return 'INSERT';
        if (trimmed.startsWith('UPDATE')) return 'UPDATE';
        if (trimmed.startsWith('DELETE')) return 'DELETE';
        if (trimmed.startsWith('CREATE')) return 'CREATE';
        if (trimmed.startsWith('ALTER')) return 'ALTER';
        if (trimmed.startsWith('DROP')) return 'DROP';
        return 'OTHER';
    }

    normalizeQuery(query) {
        // Remove parameters and normalize whitespace
        return query
            .replace(/\$\d+/g, '?')
            .replace(/\s+/g, ' ')
            .trim();
    }

    isOptimizationCandidate(query, executionTime) {
        const upperQuery = query.toUpperCase();
        
        // Check for potentially inefficient patterns
        const inefficientPatterns = [
            'SELECT *',
            'NOT EXISTS',
            'NOT IN',
            'LIKE \'%',
            'ORDER BY RANDOM()',
            'DISTINCT'
        ];

        const hasInefficientPattern = inefficientPatterns.some(pattern => 
            upperQuery.includes(pattern)
        );

        return executionTime > 500 || hasInefficientPattern;
    }

    parseRedisInfo(info) {
        const lines = info.split('\r\n');
        const stats = {};
        
        for (const line of lines) {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                stats[key] = value;
            }
        }
        
        return stats;
    }

    calculateRedisHitRate(stats) {
        const hits = parseInt(stats.keyspace_hits || 0);
        const misses = parseInt(stats.keyspace_misses || 0);
        const total = hits + misses;
        
        return total > 0 ? (hits / total) * 100 : 0;
    }

    calculateAverageQueryTime() {
        if (this.queryHistory.length === 0) return 0;
        
        const total = this.queryHistory.reduce((sum, q) => sum + q.executionTimeMs, 0);
        return total / this.queryHistory.length;
    }

    flattenMetrics(obj, prefix = '') {
        const flattened = {};
        
        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            
            if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                Object.assign(flattened, this.flattenMetrics(value, newKey));
            } else if (typeof value === 'number') {
                flattened[newKey] = value;
            }
        }
        
        return flattened;
    }

    getMetricUnit(metricName) {
        const units = {
            'cpu.usage': '%',
            'memory.systemUsagePercent': '%',
            'memory.processHeapUsed': 'bytes',
            'memory.systemTotal': 'bytes',
            'disk.usage': '%',
            'network.bytesReceived': 'bytes',
            'network.bytesSent': 'bytes',
            'database.cacheHitRatio': '%',
            'redis.usedMemory': 'bytes',
            'redis.hitRate': '%'
        };
        
        return units[metricName] || 'count';
    }

    startCollection() {
        this.isCollecting = true;
        console.log('Performance monitoring started');
    }

    stopCollection() {
        this.isCollecting = false;
        
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        
        console.log('Performance monitoring stopped');
    }

    async shutdown() {
        this.stopCollection();
        await this.flushMetrics(); // Final flush
    }
}

module.exports = PerformanceMonitor;