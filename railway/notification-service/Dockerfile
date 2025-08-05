# Railway-optimized Dockerfile for auto-alert-saas
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy application source code  
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Use Railway's dynamic port assignment
ENV PORT=${PORT:-3001}
EXPOSE ${PORT}

# Railway-compatible health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the notification service
CMD ["npm", "start"]
