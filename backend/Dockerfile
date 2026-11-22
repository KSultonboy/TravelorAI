# TravelorAI backend image.
#
#   docker build -t travelorai-backend .               -> production runtime (non-root)
#   docker build --target dev -t travelorai-backend:dev .  -> local dev (docker-compose.yml)
#
# NOTE: the live production container (voyageai_backend, podman) is NOT built
# from this file today — it is updated in place by scripts/deploy-backend.sh,
# which layers new source on top of the running image. This Dockerfile is the
# reference for a clean rebuild.

FROM node:20-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------------------------------------------------------------- dev
FROM base AS dev
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
EXPOSE 4000
CMD ["npx", "nodemon", "--legacy-watch", "server.js"]

# ---------------------------------------------------------------- runtime
FROM base AS runtime
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma/
RUN npx prisma generate

# Source files stay root-owned (read-only for the app user). The app user may
# create files in /app (e.g. OCR language cache) and write uploads/tmp.
COPY . .
RUN mkdir -p /app/uploads /app/tmp \
  && chown node:node /app /app/uploads /app/tmp

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4000/api/v1/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
