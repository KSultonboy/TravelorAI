# TravelorAI backend

Node 20, Express 4, Prisma 5 (PostgreSQL), CommonJS. Testlar: jest + supertest.

```bash
npm install
npx jest --coverage=false     # barcha testlar (bazasiz, Prisma mock bilan)
npm run dev                   # nodemon server.js
```

## Lokal baza (noldan)

`prisma/migrations` tarixi to'liq emas: 13 ta jadval faqat `prisma/manual-migrations/` da,
`TelegramMessage` uchun esa `CREATE TABLE` hech qayerda yo'q. Shu sababli **bo'sh** bazada
`prisma migrate deploy` ishlamaydi. Mavjud migratsiyalar o'zgartirilmaydi — production
`_prisma_migrations` jadvali ularga havola qiladi.

Bo'sh lokal baza uchun:

```bash
# backend/.env:  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/travelorai_dev"
npm run db:setup:dev            # schema.prisma -> db push, so'ng har bir migratsiya "applied"
npm run db:seed                 # demo ma'lumotlar (yoki: npm run db:setup:dev -- --seed)
```

`db:setup:dev` nima qiladi:

1. `NODE_ENV=production` bo'lsa, `DATABASE_URL` lokal bo'lmasa (`--allow-remote` siz) yoki
   bazada **birorta jadval bo'lsa** — to'xtaydi.
2. `prisma db push --skip-generate` — joriy `schema.prisma` dan jadvallarni yaratadi.
3. `prisma migrate resolve --applied <papka>` — `prisma/migrations` dagi har bir migratsiyani
   bajarilgan deb belgilaydi. Shundan keyin yangi migratsiyalar odatdagidek
   `npx prisma migrate deploy` bilan qo'llanadi.
4. `prisma generate`.

Mavjud (production yoki to'ldirilgan) bazada bu skriptni ishlatmang — u yerda faqat
`npx prisma migrate deploy`.

### Seed (`npm run db:seed`, `prisma/seed.js`)

Idempotent — qayta ishga tushirish xavfsiz. Productionda ishlamaydi.

- Tariflar (`/pricing` sahifasi bilan bir xil): Starter 99 000, Pro 199 000, Premium (`business`) 299 000 so'm.
- Admin tasdiqlagan demo agentlik `ipak-yoli-demo-travel` + egasi (`demo-agency@travelorai.local`,
  `SEED_AGENCY_EMAIL` bilan o'zgartiriladi), Premium obuna 30 kun.
- 3 ta demo tur: Samarqand, Buxoro, Xiva (narxlar so'mda).
- Planner uchun 3 ta `Destination` va 8 ta POI.

Parol repoda yo'q: birinchi seed'da tasodifiy yaratiladi va konsolga **bir marta** chiqadi.
Yangi parol: `SEED_RESET_PASSWORD=1 npm run db:seed`.

## Muhit o'zgaruvchilari (bu bo'limga oid)

| O'zgaruvchi | Standart | Izoh |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | AI izoh va OCR modeli |
| `AI_DAILY_LIMIT_PER_AGENCY` | `50` | Agentlik uchun kunlik AI so'rovlar soni (jarayon ichida hisoblanadi) |
| `ALLOW_CLOUD_OCR` | `false` | `true` bo'lsa, mahalliy OCR o'qiy olmagan pasport skani Anthropic'ka yuboriladi |
| `YANDEX_PROXY_PER_IP_PER_MIN` | `30` | `/yandex/*` proksi uchun per-IP limit (middleware ulanganda) |
| `HOME_INTERACTIONS_PER_TARGET_HOUR` | `5` | Bir IP bir nishon uchun soatiga reyting hodisalari |
| `HOME_INTERACTIONS_PER_IP_HOUR` | `300` | Bir IP uchun soatiga jami reyting hodisalari |
| `SEED_AGENCY_EMAIL`, `SEED_RESET_PASSWORD` | — | Faqat `db:seed` uchun |
