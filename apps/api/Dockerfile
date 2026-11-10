
FROM node:22-bookworm-slim

WORKDIR /app

# Cài thư viện hệ thống cần thiết cho Prisma
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Cài dependencies
COPY package*.json ./
RUN npm ci

# Sao chép source code
COPY prisma ./prisma
COPY tsconfig.json nest-cli.json ./
COPY src ./src

# Tạo Prisma Client và build NestJS
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Chạy ứng dụng đã build
CMD ["node", "dist/src/main.js"]
