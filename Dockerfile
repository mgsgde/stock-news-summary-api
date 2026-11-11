# Build stage: install all dependencies, generate tsoa routes, compile TypeScript
FROM node:24-trixie-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage: only production dependencies and compiled code
FROM node:24-trixie-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# SQLite file lives in /app/data (mounted as a volume), owned by the non-root user
RUN mkdir -p /app/data && chown -R node:node /app/data
ENV DATABASE_PATH=/app/data/app.sqlite
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
