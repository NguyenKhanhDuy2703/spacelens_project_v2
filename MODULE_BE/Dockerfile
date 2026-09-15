# Stage 1: Build NestJS application
FROM node:22-alpine AS builder

WORKDIR /app

# Upgrade OS packages to patch known Alpine CVEs
RUN apk update && apk upgrade --no-cache

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Upgrade OS packages to patch known Alpine CVEs (libcrypto3, libssl3, libuuid)
RUN apk update && apk upgrade --no-cache

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
