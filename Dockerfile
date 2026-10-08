# ==============================================================================
# Hardened Multi-Stage Containerfile
# Reference: Section 15.3 of architettura_sicurezza_web.txt
# ==============================================================================

# 1. Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies needed for build
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# 2. Production Runtime Stage (Minimal Attack Surface)
FROM node:22-alpine AS runner

WORKDIR /app

# Install security utilities: dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Copy dependency manifests and install production-only dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application assets and compiled client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/index.html ./index.html

# Security: run as unprivileged user (Section 15.3: runAsNonRoot)
RUN chown -R node:node /app
USER node

# Health check (Section 13.6)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/health || exit 1

EXPOSE 3001

# Run with dumb-init as PID 1
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "--loader", "./server/loader.mjs", "--experimental-strip-types", "server/index.ts"]
