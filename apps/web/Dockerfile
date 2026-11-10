# Multi-stage Dockerfile for Next.js Web Frontend (Production-grade)
# Stage 1: Install dependencies
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Stage 2: Build application
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and built standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["npm", "run", "start"]

