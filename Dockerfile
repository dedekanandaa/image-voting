FROM oven/bun:1.1.38-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM node:20.18-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
RUN apk add --no-cache openssl libc6-compat
COPY . .
RUN npx prisma generate && npm run build

FROM node:20.18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl dumb-init openssl libc6-compat
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads && chmod 750 /app/uploads
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -H 0.0.0.0 -p 3000"]
