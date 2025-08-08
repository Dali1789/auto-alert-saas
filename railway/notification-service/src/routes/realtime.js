const express = require('express');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Store active connections
const connections = new Map();

/**
 * Server-Sent Events endpoint for real-time updates
 * GET /api/realtime/subscribe
 */
router.get('/subscribe', authenticateToken, (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

  const userId = req.user.userId;
  const connectionId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // Store connection
  connections.set(connectionId, {
    userId,
    response: res,
    connectedAt: new Date(),
    lastPing: new Date()
  });

  console.log(`🔗 SSE connection established for user ${userId} (${connectionId})`);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    connectionId,
    timestamp: new Date().toISOString(),
    message: 'Real-time connection established'
  })}\n\n`);

  // Send periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    if (!connections.has(connectionId)) {
      clearInterval(heartbeatInterval);
      return;
    }

    const connection = connections.get(connectionId);
    connection.lastPing = new Date();

    try {
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      })}\n\n`);
    } catch (error) {
      console.log(`💔 Heartbeat failed for connection ${connectionId}`);
      connections.delete(connectionId);
      clearInterval(heartbeatInterval);
    }
  }, 30000); // Every 30 seconds

  // Handle client disconnect
  req.on('close', () => {
    console.log(`🔌 SSE connection closed for user ${userId} (${connectionId})`);
    connections.delete(connectionId);
    clearInterval(heartbeatInterval);
  });

  // Handle connection abort
  req.on('aborted', () => {
    console.log(`🚫 SSE connection aborted for user ${userId} (${connectionId})`);
    connections.delete(connectionId);
    clearInterval(heartbeatInterval);
  });
});

/**
 * Send real-time update to specific user
 * POST /api/realtime/notify
 */
router.post('/notify', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, type, data, broadcast = false } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Notification type is required'
      });
    }

    const message = {
      type,
      data,
      timestamp: new Date().toISOString(),
      from: req.user.userId
    };

    let notifiedConnections = 0;

    for (const [connectionId, connection] of connections.entries()) {
      // Send to specific user or broadcast to all
      if (broadcast || connection.userId === targetUserId) {
        try {
          connection.response.write(`data: ${JSON.stringify(message)}\n\n`);
          notifiedConnections++;
        } catch (error) {
          console.error(`Failed to send to connection ${connectionId}:`, error);
          connections.delete(connectionId);
        }
      }
    }

    res.json({
      success: true,
      message: 'Notification sent',
      connectionsNotified: notifiedConnections
    });

  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notification',
      details: error.message
    });
  }
});

/**
 * Get active connections status
 * GET /api/realtime/status
 */
router.get('/status', authenticateToken, (req, res) => {
  const status = {
    totalConnections: connections.size,
    userConnections: Array.from(connections.values()).filter(c => c.userId === req.user.userId).length,
    connections: Array.from(connections.entries()).map(([id, conn]) => ({
      id,
      userId: conn.userId,
      connectedAt: conn.connectedAt,
      lastPing: conn.lastPing
    }))
  };

  res.json({
    success: true,
    status
  });
});

/**
 * Broadcast system-wide notification
 * POST /api/realtime/broadcast
 */
router.post('/broadcast', authenticateToken, async (req, res) => {
  try {
    const { type, message, data } = req.body;

    // Only allow admin users to broadcast (you might want to implement proper role checking)
    if (!req.user.isAdmin && req.user.userId !== 'system') {
      return res.status(403).json({
        success: false,
        error: 'Broadcast permission denied'
      });
    }

    const broadcastMessage = {
      type: type || 'system_broadcast',
      message,
      data,
      timestamp: new Date().toISOString(),
      from: 'system'
    };

    let notifiedConnections = 0;

    for (const [connectionId, connection] of connections.entries()) {
      try {
        connection.response.write(`data: ${JSON.stringify(broadcastMessage)}\n\n`);
        notifiedConnections++;
      } catch (error) {
        console.error(`Failed to broadcast to connection ${connectionId}:`, error);
        connections.delete(connectionId);
      }
    }

    res.json({
      success: true,
      message: 'Broadcast sent',
      connectionsNotified: notifiedConnections
    });

  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send broadcast',
      details: error.message
    });
  }
});

// ========================================
// HELPER FUNCTIONS FOR OTHER MODULES
// ========================================

/**
 * Send real-time notification to user
 */
function notifyUser(userId, type, data) {
  let notifiedConnections = 0;

  for (const [connectionId, connection] of connections.entries()) {
    if (connection.userId === userId) {
      try {
        const message = {
          type,
          data,
          timestamp: new Date().toISOString()
        };

        connection.response.write(`data: ${JSON.stringify(message)}\n\n`);
        notifiedConnections++;
      } catch (error) {
        console.error(`Failed to notify connection ${connectionId}:`, error);
        connections.delete(connectionId);
      }
    }
  }

  return notifiedConnections;
}

/**
 * Send notification to all connected users
 */
function broadcastToAll(type, data) {
  let notifiedConnections = 0;

  const message = {
    type,
    data,
    timestamp: new Date().toISOString(),
    from: 'system'
  };

  for (const [connectionId, connection] of connections.entries()) {
    try {
      connection.response.write(`data: ${JSON.stringify(message)}\n\n`);
      notifiedConnections++;
    } catch (error) {
      console.error(`Failed to broadcast to connection ${connectionId}:`, error);
      connections.delete(connectionId);
    }
  }

  return notifiedConnections;
}

/**
 * Get connection statistics
 */
function getConnectionStats() {
  const userConnections = new Map();
  
  for (const connection of connections.values()) {
    const count = userConnections.get(connection.userId) || 0;
    userConnections.set(connection.userId, count + 1);
  }

  return {
    totalConnections: connections.size,
    uniqueUsers: userConnections.size,
    averageConnectionsPerUser: userConnections.size > 0 ? connections.size / userConnections.size : 0,
    connectionsByUser: Object.fromEntries(userConnections)
  };
}

// Clean up stale connections every 5 minutes
setInterval(() => {
  const now = new Date();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes

  for (const [connectionId, connection] of connections.entries()) {
    if (now - connection.lastPing > staleThreshold) {
      console.log(`🧹 Cleaning up stale connection ${connectionId}`);
      try {
        connection.response.end();
      } catch (error) {
        // Connection might already be closed
      }
      connections.delete(connectionId);
    }
  }

  if (connections.size > 0) {
    console.log(`📊 Active SSE connections: ${connections.size}`);
  }
}, 5 * 60 * 1000);

module.exports = { 
  router, 
  notifyUser, 
  broadcastToAll, 
  getConnectionStats 
};