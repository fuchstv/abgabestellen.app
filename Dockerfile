# Multi-stage production Dockerfile for abgabestellen.app (Cloud Run europe-west3)

# Stage 1: Build Frontend and Backend
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install native compilation dependencies for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json vite.config.ts tailwind.config.js postcss.config.js ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Stage 2: Production Dependencies Only
FROM node:22-bookworm-slim AS runner-deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 3: Production Runner
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/abgabestellen.db

# Create persistent data volume for SQLite & Litestream
RUN mkdir -p /data && chown -R node:node /data

# Copy production node_modules and built artifacts
COPY --from=runner-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 8080) + '/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server/index.mjs"]
