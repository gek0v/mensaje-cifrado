# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build Next.js app
# Next.js build needs environment variables, so we might need to pass them or build in a way that ignores them if they are runtime only.
# Usually for build we just need standard envs.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# We need to allow next build to run. Next.js might try to connect to things or check types.
# We skip linting during build to save time and avoid strict errors stopping deploy (since we check locally).
RUN bun run build

# Production image
FROM oven/bun:1 as runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=base /app/public ./public
COPY --from=base /app/.next ./.next
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/bun.lock ./bun.lock

# Install only production dependencies
RUN bun install --frozen-lockfile --production

COPY --from=base /app/server.ts ./server.ts
COPY --from=base /app/lib ./lib

# Change ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["bun", "server.ts"]
