# Synology Container Manager용 Next.js 앱 이미지
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Synology DSM @eaDir folders become Next parallel-route slots and break LayoutProps.
RUN find . -type d \( -name '@eaDir' -o -name '#recycle' -o -name '@tmp' -o -name '@SynoResource' \) -prune -exec rm -rf {} +
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=
# migrate는 DATABASE_URL 없을 때 no-op → Docker 시작 시 entrypoint에서 실행
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh

# migrate.mjs 용 pg (standalone 번들과 별도)
RUN npm install --omit=dev pg@8.23.1 \
  && chmod +x /docker-entrypoint.sh \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
