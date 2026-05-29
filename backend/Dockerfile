FROM node:20-alpine AS base

WORKDIR /app

# Install production dependencies only
COPY package.json ./
RUN npm install --production=false

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S recurra && \
    adduser -S recurra -u 1001

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

# Security headers
ENV NODE_ENV=production

USER recurra

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
