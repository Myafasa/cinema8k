# The same image serves the web app and the scheduled worker.
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    ROOT_DOMAIN="example.invalid" \
    AUTH_SECRET="build-only-secret-build-only-secret" \
    TICKET_HMAC_SECRET="build-only-ticket-secret-build-only-secret" \
    sh -c 'npx prisma generate && npm run build'

FROM base AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Worker is a separate process in the same image; its TS runtime is included.
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/tsconfig.json ./tsconfig.json
USER node
EXPOSE 3000
CMD ["node", "server.js"]
