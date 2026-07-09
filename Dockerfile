# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:20-alpine AS backend-build

WORKDIR /app/backend

# Install dependencies
COPY backend/package.json backend/package-lock.json* ./
RUN npm install

# Copy source and compile TypeScript
COPY backend/ ./
RUN npm run build

# ============================================
# Stage 3: Production Image
# ============================================
FROM node:20-slim AS production

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend build and production dependencies
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/package.json ./
COPY --from=backend-build /app/backend/node_modules ./node_modules

# Copy frontend build to be served as static files
COPY --from=frontend-build /app/frontend/dist ./public

# Create data directory for persistent config
RUN mkdir -p /app/data

# Default environment
ENV NODE_ENV=production
ENV PORT=3001
ENV SRS_HOST=srs
ENV SRS_API_PORT=1985
ENV SRS_RTMP_PORT=1935

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:3001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
