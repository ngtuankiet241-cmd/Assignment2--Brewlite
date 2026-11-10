# Multi-stage Dockerfile for NestJS API (Production-grade)
# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Create non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy package manifests and production dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Switch to non-root user
USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/main.js"]

