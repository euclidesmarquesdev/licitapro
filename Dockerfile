# Multi-stage Dockerfile for LicitaPro Production
# Stage 1: Build & bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies needed for native libraries or builds
RUN apk add --no-cache libc6-compat python3 make g++

# Install dependencies first (leverage Docker layer caching)
COPY package*.json ./
RUN npm ci

# Copy code and build both frontend assets & modular backend bundle
COPY . .
RUN npm run build

# Stage 2: Minimalist production runtime environment
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 exectrans

# Install only production dependencies (saves disk space & limits exposure)
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist
# If we used Prisma, copy schemas
# COPY --from=builder /app/prisma ./prisma

USER exectrans

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
