FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server/ ./server/
COPY public/ ./public/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server/index.js"]
