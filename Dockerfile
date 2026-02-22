# Stage 1: Install ALL dependencies (cached unless package-lock changes)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build server + client bundles
FROM deps AS builder
COPY tsconfig.json build-client.mjs build-server.mjs ./
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
RUN npm run build

# Stage 3: Production dependencies only (separate stage for caching)
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force && \
    rm -rf /root/.npm /tmp/*

# Stage 4: Minimal production image
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# Only copy prod node_modules + built output — no source, no devDeps
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
# Remove npm/yarn (not needed at runtime) to save ~20MB
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm \
           /usr/local/bin/npx /usr/local/lib/node_modules/corepack \
           /usr/local/bin/corepack /opt/yarn* /tmp/* /root/.npm
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1
USER node
CMD ["node", "dist/server/index.js"]
