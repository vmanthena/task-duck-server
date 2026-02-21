# Stage 1: Build (has devDependencies + source)
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json build-client.mjs build-server.mjs ./
COPY server/ ./server/
COPY client/ ./client/
RUN npm run build

# Stage 2: Production (only dist + runtime deps)
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force && rm -rf /root/.npm /tmp/*
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1
USER node
CMD ["node", "dist/server/index.js"]
