# Agentic Employee v2 - Docker Image
# Multi-stage build for smaller image size

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist

# Copy scripts
COPY scripts/ ./scripts/

# Copy config files
COPY .env.example ./

# Create data directory
RUN mkdir -p /app/.data

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD node -e "require('./dist/utils/validate-config.js').hasAnyProvider() || process.exit(1)"

# Default command (can be overridden)
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]
