# Build stage
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

# Copy entire monorepo
COPY . .

# Copy config files into apps/web/config for the build
COPY config ./apps/web/config

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build Next.js app
RUN pnpm --filter @wpi/web build

# Production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output (preserves apps/web layout) and static assets
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/web/server.js"]
