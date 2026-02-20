FROM node:22-alpine

# argon2 needs build tools for native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --production && npm cache clean --force

# Remove build tools after argon2 is compiled
RUN apk del python3 make g++

COPY server/ ./server/
COPY public/ ./public/
COPY hash-password.js ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server/index.js"]
