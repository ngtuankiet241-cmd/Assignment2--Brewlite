FROM node:22-bookworm-slim

WORKDIR /app

# Cài thư viện hệ thống cần thiết cho Prisma và wget cho healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

# Cài dependencies
COPY package*.json ./
RUN npm ci

# Sao chép source code
COPY prisma ./prisma
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Tạo Prisma Client và build NestJS
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Chạy ứng dụng đã build (hỗ trợ cả dist/src/main.js và dist/main.js)
CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
