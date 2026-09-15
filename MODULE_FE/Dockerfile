# Stage 1: Build Vite React application
FROM node:22-alpine AS builder

WORKDIR /app

# Upgrade Alpine OS packages to patch known CVEs
RUN apk update && apk upgrade --no-cache

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:alpine AS runner

# Upgrade Alpine OS packages to patch known CVEs (libcrypto3, libssl3, libuuid)
RUN apk update && apk upgrade --no-cache

COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx configuration for Single Page Application routing
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
