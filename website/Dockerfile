# syntax=docker/dockerfile:1
# TravelorAI website (Next.js 16) — multi-stage, non-root.
#
# DIQQAT (AGENTS.md §3): prod'da kod ishlayotgan konteyner ICHIDA qayta build
# qilinadi (`node node_modules/next/dist/bin/next build`) va `podman restart`
# bilan `next start` ishga tushadi. Shu sababli runtime bosqichida to'liq
# node_modules va manba kodi saqlanadi ('output: standalone' ishlatilmaydi) va
# /app `node` foydalanuvchisiga tegishli (u yerda build yozila oladi).
#
# Maxfiy qiymatlar (ADMIN_*, sessiya kaliti va h.k.) build ARG sifatida
# BERILMAYDI va image'ga yozilmaydi — faqat runtime'da `-e`/env-file orqali.

ARG NODE_IMAGE=node:20-alpine

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
# Faqat ommaviy (brauzer bundle'iga kiradigan) qiymatlar.
ARG NEXT_PUBLIC_SITE_URL=https://travelorai.com
ARG NEXT_PUBLIC_API_URL=https://travelorai.com/api/v1
# Ommaviy Google OAuth web client id (sir emas). 65326209075-... loyihasi
# ishlamaydi — AGENTS.md §3 bo'yicha faqat 401741517790-... ishlatiladi.
ARG NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=401741517790-11c61fghvchvld521kdi0fu4ee1mo2af.apps.googleusercontent.com
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node node_modules/next/dist/bin/next build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL=https://travelorai.com
ARG NEXT_PUBLIC_API_URL=https://travelorai.com/api/v1
ARG NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=401741517790-11c61fghvchvld521kdi0fu4ee1mo2af.apps.googleusercontent.com
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
# Konteyner ichida qayta build qilish (AGENTS.md §3) uchun manba + node_modules ham kerak.
COPY --from=builder --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
