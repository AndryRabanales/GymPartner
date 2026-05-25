# Stage 1: Build front-end
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production environment (super lightweight)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies (excludes Vite, TypeScript, ESLint, Tailwind, etc.)
COPY package*.json ./
RUN npm ci --only=production

# Copy static assets, server, and scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/scripts ./scripts

EXPOSE 8080

CMD ["node", "server.js"]
