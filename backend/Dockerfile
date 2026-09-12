# Use Node.js 20 LTS Alpine as base
FROM node:20-alpine AS base

# Install build dependencies for sharp native bindings
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev || npm install --production

# Copy application source
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Expose HTTP port
EXPOSE 5000

# Start server
CMD ["node", "src/server.js"]
