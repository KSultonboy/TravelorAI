# TravelorAI - O'zbekiston Sayohat Rejalash Ilovasi

## Ishga tushirish

### Birinchi marta

```bash
# 1. Faqat DB va cache
docker-compose up -d postgres redis

# 2. Backend setup
cd backend
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run db:seed

# 3. Hamma servislarga ishga tushirish
cd ..
docker-compose up -d

# 4. Mobile
cd mobile
npm install
npx expo start
```

### Har kunlik ishlab chiqish

```bash
docker-compose up -d
cd mobile && npx expo start
```

## Gemini planner setup (API keygacha hammasi tayyor)

Backend planner hozir fallback bilan ishlaydi: Gemini bo'lmasa ham reja qaytadi.
Gemini refinements yoqish uchun faqat `backend/.env` ga key qo'yish kerak:

```bash
GEMINI_PLANNER_ENABLED=true
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-2.5-flash
```

Ixtiyoriy:

```bash
GEMINI_TIMEOUT_MS=9000
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com
```

## Foydali buyruqlar

```bash
docker-compose logs -f backend     # loglar
cd backend && npx prisma studio    # DB GUI
docker-compose restart backend     # backend qayta ishga tushirish
docker-compose down                # to'xtatish
docker-compose down -v             # to'xtatish + volumelarni o'chirish
```

## Portlar

| Port | Servis |
|------|--------|
| 80   | Nginx (API gateway) |
| 4000 | Backend (to'g'ridan-to'g'ri) |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 8081 | Expo Dev Server |

## Mobile production config

Mobile app production build quyidagi public env qiymatlarini kutadi:

```bash
EXPO_PUBLIC_API_URL=https://travelorai.com/api/v1
EXPO_PUBLIC_API_PORT=4000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_RELEASE=
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=
EXPO_PUBLIC_USD_TO_UZS=13000
```

`.env`, `credentials.json`, keystore, SSH key va Google Play service account JSON fayllarini gitga commit qilmang.

## Test case

```bash
curl -X POST http://localhost:4000/api/v1/planner/generate \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 2000000,
    "duration": 5,
    "travelers": 2,
    "style": "mid",
    "interests": ["tarixiy", "madaniy"],
    "departureCity": "toshkent"
  }'
```

Kutilayotgan natija:
- `success: true`
- `destinations: ["Samarqand", "Buxoro"]`
- `totalCost: 1700000-1950000`
- `budgetUsed: 85-97%`

## Stack

- **Mobile**: React Native (Expo SDK 54), Expo Router, AsyncStorage
- **Backend**: Node.js 20, Express.js 4, Prisma ORM, PostgreSQL 16, Redis 7
- **DevOps**: Docker, Docker Compose, Nginx
