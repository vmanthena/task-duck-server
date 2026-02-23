# Stage 1: Install ALL dependencies (cached unless package-lock changes)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build server + client bundles (all deps bundled into output)
FROM deps AS builder
COPY tsconfig.json build-client.mjs build-server.mjs ./
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
RUN npm run build

# Stage 3: Compress Bun binary with UPX (only pulled when building upx target)
FROM oven/bun:1-alpine AS compressor
RUN apk add --no-cache upx \
 && upx --best --lzma -o /tmp/bun /usr/local/bin/bun

# ── OCI metadata (populated by CI or docker-build.sh) ──
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown
ARG VERSION=4.0.0

# Stage 4a: Standard production image (target: production)
# Used as input for SlimToolkit — AV/enterprise-scanner compatible
FROM alpine:3.21 AS production

ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.title="Task Duck" \
      org.opencontainers.image.description="AI-powered scope discipline tool" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="https://github.com/vmanthena/task-duck-server" \
      org.opencontainers.image.vendor="vmanthena"

COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/dist ./dist

RUN apk add --no-cache tini \
 && adduser -D appuser \
 && chmod -R 555 /app/dist \
 && chmod 555 /usr/local/bin/bun \
 && apk --purge del apk-tools \
 && rm -rf /var/cache/apk /etc/apk /lib/apk /usr/share/apk

USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "run", "dist/server/index.js"]

# Stage 4b: UPX-compressed image (target: upx)
FROM alpine:3.21 AS upx

ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.title="Task Duck" \
      org.opencontainers.image.description="AI-powered scope discipline tool" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="https://github.com/vmanthena/task-duck-server" \
      org.opencontainers.image.vendor="vmanthena"

COPY --from=compressor /tmp/bun /usr/local/bin/bun
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/dist ./dist

RUN apk add --no-cache tini \
 && adduser -D appuser \
 && chmod -R 555 /app/dist \
 && chmod 555 /usr/local/bin/bun \
 && apk --purge del apk-tools \
 && rm -rf /var/cache/apk /etc/apk /lib/apk /usr/share/apk

USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "run", "dist/server/index.js"]
