# TravelorAI — CLICK to'lov tizimi (yagona: ilova + sayt)

## Arxitektura — nega ilovada to'lasangiz saytda ham ishlaydi

Obuna holati **bitta joyda** saqlanadi — backend bazasida, `User` yozuvida
(`premiumUntil`, `premiumPlan`). Ilova ham, sayt ham **bitta** `User` akkauntidan
foydalanadi:

```
Mobil ilova ──(Bearer token)──────────┐
                                      ├──► Backend /api/v1/payments/* ──► User.premiumUntil
Sayt ──(cookie → /api/backend proxy)──┘         ▲
                                                │ (imzolangan server-to-server callback)
                              CLICK ────────────┘
```

- Ilovada to'lansa → backend `User.premiumUntil` ni yangilaydi → saytga o'sha
  akkaunt bilan kirilganda `GET /auth/me` premium holatini ko'rsatadi.
- Saytda to'lansa → xuddi shu yozuv yangilanadi → ilova ham ko'radi.
- To'lov holatining YAGONA manbai — CLICK'ning imzolangan `complete` callback'i.
  Redirect (return sahifasi) hech qachon to'lov isboti sifatida ishlatilmaydi.

Bitta CLICK shartnomasi (bitta `service_id`) ikkala mahsulotga xizmat qiladi:

| To'lovchi | Buyurtma prefiksi | Nima ochiladi |
|---|---|---|
| Agentlik (kabinet tarifi) | `TA...` | `TourAgency.subscriptionUntil` |
| Foydalanuvchi (Premium) | `TU...` | `User.premiumUntil` |

Callback'da tranzaksiya `merchant_trans_id` bo'yicha topiladi va `payerType`
bo'yicha to'g'ri faollashtirish tanlanadi (`fulfill()` —
`backend/src/controllers/clickPayment.controller.js`).

## CLICK'dan nimalar kerak (shartnoma tuzilgach CLICK beradi)

`backend/.env` ga yoziladi (FAQAT backend'ga — website konteyneriga emas):

| O'zgaruvchi | CLICK kabinetida nomi | Izoh |
|---|---|---|
| `CLICK_SERVICE_ID` | Service ID (xizmat ID) | Majburiy |
| `CLICK_MERCHANT_ID` | Merchant ID (savdogar ID) | Majburiy |
| `CLICK_SECRET_KEY` | Secret key | Majburiy — imzo tekshiruvi uchun. MAXFIY! |
| `CLICK_MERCHANT_USER_ID` | Merchant user ID | Ixtiyoriy (Merchant API uchun) |

CLICK kabinetida (merchant.click.uz) **SHOP API** turini tanlab, callback
manzillarini ro'yxatdan o'tkazish kerak (HTTPS shart):

```
Prepare  URL: https://travelorai.com/api/v1/payments/click/prepare
Complete URL: https://travelorai.com/api/v1/payments/click/complete
```

Qo'shimcha backend sozlamalari:

```bash
PUBLIC_SITE_URL=https://travelorai.com   # return sahifasi shu domen ostida
USER_PREMIUM_PRICE_UZS=29000             # Premium oylik narxi (so'mda) — O'ZGARTIRING
```

Kalitlar kiritilmaguncha to'lov tugmalari "sozlanmagan" holatda turadi — hech
narsa buzilmaydi.

## Endpointlar

Ommaviy (CLICK server-to-server, imzo bilan himoyalangan, auth yo'q):

- `POST /api/v1/payments/click/prepare` — action=0, tranzaksiyani tekshirish
- `POST /api/v1/payments/click/complete` — action=1, xizmatni ochish

Foydalanuvchi (Bearer token / sayt proxy cookie):

- `GET  /api/v1/payments/plans` — Premium planlar + (login bo'lsa) joriy holat
- `POST /api/v1/payments/checkout` — `{planSlug, months(1-12), platform}` → CLICK havolasi
- `GET  /api/v1/payments/status/:merchantTransId` — faqat tranzaksiya egasiga
- `GET  /api/v1/payments/me` — premium holati + to'lovlar tarixi

Agentlik oqimi o'zgarmagan: `POST /agency/payments/checkout` va boshqalar.

## Migratsiya (prod)

```bash
# konteyner ichida:
psql "$DATABASE_URL" -f prisma/manual-migrations/2026-08-05_user_premium_click.sql
npx prisma generate
```

SQL additive — mavjud ma'lumotga ta'sir qilmaydi (`agencyId` NULL'ga ruxsat
beriladi, eski yozuvlar `payerType='agency'` default oladi).

## Xavfsizlik choralari (amalga oshirilgan)

1. **Imzo tekshiruvi** — har bir callback'da `sign_string` (MD5 + secret key)
   `crypto.timingSafeEqual` bilan solishtiriladi; `service_id` ham tekshiriladi.
   User va agency tranzaksiyalari BITTA `verifySign` yo'lidan o'tadi.
2. **Summa faqat serverda** — klient hech qachon narx yubormaydi, faqat plan va
   oy soni (1–12 clamp). Callback'dagi summa bazadagi tranzaksiya bilan
   solishtiriladi.
3. **Idempotentlik / replay** — `created → prepared → paid/cancelled` holat
   mashinasi; takroriy `complete` "Already paid" qaytaradi;
   `merchant_prepare_id` mosligi tekshiriladi; `prepareId/confirmId` endi
   kripto-tasodifiy (`crypto.randomInt`).
4. **IDOR himoyasi** — `GET /payments/status/:id` faqat `tx.userId === user.id`
   bo'lsa javob beradi (aks holda 404); javobdan userId olib tashlanadi.
5. **Kuchaytirilgan auth** — to'lov endpointlari oddiy JWT'ga ishonmaydi:
   `requireDbUser` har so'rovda DB'dan userni tekshiradi (bloklangan/o'chirilgan
   akkauntlar rad etiladi), checkout uchun email tasdiqlangan bo'lishi shart,
   agentlik tokenlari (`role` claim) rad etiladi.
6. **Rate limiting** — checkout alohida limitga ega (15 daqiqada 10); bitta
   userda 1 soat ichida 5 tadan ortiq ochiq tranzaksiya bo'lmaydi. CLICK
   callback'lari esa limiterdan CHETDA (to'lov tasdig'i 429 ga urilmasligi kerak).
7. **return_url oq ro'yxati** — faqat `PUBLIC_SITE_URL/payment/return` — klient
   ixtiyoriy URL bera olmaydi (open redirect yo'q).
8. **Sir saqlash** — `CLICK_SECRET_KEY` faqat backend'da; website konteyneriga
   endi backend `.env` uzatilmaydi (docker-compose.yml tuzatildi).
   `AGENCY_JWT_SECRET` ni `JWT_SECRET` dan FARQLI qiling.
9. **Pul-birinchi qoida** — `complete`da pul olingandan keyin xato qaytarilmaydi;
   faollashtirish muammosi `errorNote: ACTIVATION_FAILED` bilan logga tushadi —
   buni monitoring qiling.
10. **Moliyaviy izlar** — `UserPayment` yozuvlari akkaunt o'chirilsa ham qoladi
    (`ON DELETE SET NULL` + email snapshot).

## Admin panel — to'lov aylanmasi va xavfsizlik monitoring

`/admin/billing` sahifasida endi (agentlik statistikasidan tashqari):

- **CLICK aylanmasi** — jami, oxirgi 30 kun, shundan Premium (user) va shundan
  agentlik ulushi (so'mda), faol Premium foydalanuvchilar soni.
- **"Faollashtirish xatoligi" ogohlantirishi** — pul CLICK'dan olingan, lekin
  `activateSubscription`/`activateUserPremium` xatoga uchragan tranzaksiyalar
  qizil bannerda ko'rinadi (`errorNote LIKE 'ACTIVATION_FAILED%'`). Bu — moliyaviy
  nomuvofiqlikni (pul olingan, xizmat ochilmagan) darhol ko'rish uchun asosiy signal.
- **CLICK tranzaksiyalari jadvali** — barcha urinishlar (created/prepared/paid/
  cancelled), agentlik/Premium filtri bilan — to'lov oqimini audit qilish uchun.
- **Premium to'lovlar jadvali** — `UserPayment` tarixi (kim, qancha, qachon).

Backend endpointlari (`adminAuthMiddleware` bilan himoyalangan, faqat admin):

- `GET /admin/payments-overview` — birlashtirilgan aylanma + xavfsizlik signali
- `GET /admin/click-transactions?state=&payerType=&take=` — audit ro'yxati
- `GET /admin/user-payments` — Premium to'lovlar tarixi

## Tekshirilgan: to'lov → Premium ochilishi → muddat uzayishi (real test)

`backend/src/controllers/clickPayment.controller.e2e.test.js` — Postgres'siz,
lekin ASL kontroller kodini (o'zgartirmasdan) haqiqiy MD5 imzo bilan yasalgan
CLICK so'rovlari orqali haydab tekshiradigan test. `npm test` bilan ishga
tushadi. Isbotlangan holatlar:

- To'g'ri imzolangan to'lov → `User.premiumUntil` kelajakka o'rnatiladi,
  `UserPayment` yozuvi tushadi.
- Ikkinchi to'lov muddatni **bugundan qayta boshlamaydi** — mavjud muddat
  ustiga qo'shadi (stacking real ishlaydi, sizning "vaqtni uzaytirib
  bo'ladimi" degan savolingizga aynan javob).
- CLICK tasdiqni qayta yuborsa (retry) — obuna ikki marta kreditlanmaydi.
- Soxta imzo, mos kelmagan summa — rad etiladi, hech narsa ochilmaydi.
- Boshqa foydalanuvchi tranzaksiyani ko'ra olmaydi (IDOR).
- Agentlik tarif oqimi ham (eskisidek) buzilmagan.

Bularning barchasi **kod darajasida** tasdiqlangan. Haqiqiy CLICK
akkaunti/kalitlari bilan hali bitta ham jonli to'lov qilinmagan — buning
uchun quyidagi bo'limdagi CLICK'ning o'z test protsedurasi (Click Up ilovasi
bilan) kerak.

## So'rov/javob loglari (CLICK qo'llab-quvvatlash talabi)

CLICK: *"настроить систему логирования запросов и ответов на своем сервере, в
точках доступа Prepare и Complete — это ускорит поиск и решение проблем"*.

Amalga oshirildi — `backend/src/controllers/clickPayment.controller.js`
`winston` logger orqali (`src/config/logger.js`) har bir Prepare/Complete
so'rovini va bizning javobimizni yozadi:

- `[click:prepare] IN` / `[click:complete] IN` — kelgan so'rov (action,
  click_trans_id, service_id, merchant_trans_id, merchant_prepare_id, amount,
  error, sign_time). **`sign_string` HECH QACHON loglanmaydi.**
- `[click:prepare] OUT` / `[click:complete] OUT` — biz qaytargan javob (error
  kodi, merchant_confirm_id/prepare_id va h.k.).

Muammo bo'lsa (CLICK guruhiga "логи отправьте" deyishsa), shu loglarni
`docker logs travelorai_backend` / `podman logs voyageai_backend`dan olib
yuboring — `merchant_trans_id` bo'yicha IN/OUT juftini topish oson.

## Production'ga ulash — CLICK'ning talabi bo'yicha bosqichlar

CLICK guruhidan kelgan yo'riqnoma bo'yicha (2026-08-05, Nigora Yuldasheva):

1. **Test rejimida tekshirish** — https://docs.click.uz/click-api-testing
   dagi test dasturi bilan Prepare/Complete to'g'ri ishlashini tasdiqlang.
2. **Sinov to'lovi** (haqiqiy pulsiz, kichik summa bilan):
   - Telefonga **Click Up** ilovasini o'rnating.
   - Havolani oching: `https://my.click.uz/services/pay?service_id=<SERVICE_ID>&merchant_id=<MERCHANT_ID>&amount=1000&transaction_param=test`
     (bu — `backend/src/config/click.js`dagi `buildPayUrl()` funksiyasi
     yasaydigan havolaning aynan o'zi, `transaction_param` = bizning
     `merchant_trans_id`).
   - Chiqqan formada telefon raqami yoki karta ma'lumotini kiriting — invoys
     (счёт) chiqadi.
   - Click Up ilovasida shu invoysni to'lang.
   - Xato chiqsa — yuqoridagi Prepare/Complete loglarini CLICK guruhiga yuboring.
3. **Xizmatni faollashtirish (MAJBURIY — bosilmasa to'lovlar ishlamaydi):**
   - `merchant.click.uz` kabinetiga kiring.
   - Chapdagi **"Сервисы"** bo'limiga o'ting.
   - Kerakli xizmat qatorida, eng o'ngdagi **"Действие"** ustunida qalam
     ikonkasini bosing.
   - Prepare/Complete manzillarini kiriting (yuqoridagi bo'limga qarang) va
     saqlang.
   - **Shundan keyin CLICK guruhiga yozib, xizmatni faollashtirishni so'rang**
     — yangi xizmat default holatda O'CHIQ turadi, ular qo'lda yoqadi.
4. **Statik IP / TAS-IX tarmog'i** — agar backend serveringiz TAS-IX
   tarmog'ida bo'lmasa (masalan xorijiy hosting), **birinchi haqiqiy
   to'lovdan OLDIN** CLICK guruhiga domen, IP va portni yuborib, firewall
   oq ro'yxatiga qo'shishlarini so'rang. IP manzil **statik** bo'lishi shart;
   uni o'zgartirishdan oldin ham avval ularga xabar bering.

## Fiskalizatsiya — HAL QILINISHI KERAK bo'lgan talab

> CLICK: *"фискализация чеков является обязательной ... в случае если вы
> используете более 1 ИКПУ, необходимо интегрировать метод фискализации
> чеков"* — https://docs.click.uz/merchant-api/fiscalization

**Bu bizga tegishli bo'lishi ehtimoli katta**: hozir tizimda ikki xil
mahsulot bor — agentlik tarif obunasi va traveler Premium obunasi. Agar
soliq organlari oldida bular alohida ИКПУ (tovar/xizmat tasnif kodi) bilan
hisoblansa, fiskal chek integratsiyasi **majburiy** bo'ladi.

**Nega hozir amalga oshirilmadi:** `docs.click.uz/merchant-api/fiscalization`
sahifasi JavaScript orqali render qilinadi va avtomatik o'qish vositalari
(shu jumladan shu suhbatdagi WebFetch) faqat sahifa qobig'ini ko'radi, aniq
API sxemasini (endpoint, maydonlar, JSON namunasi) olib bo'lmadi — noaniq
ma'lumot asosida to'lov/soliq kodini yozish xavfli, shuning uchun taxmin
qilinmadi.

**Keyingi qadam (sizdan kerak):**
- `docs.click.uz/merchant-api/fiscalization` sahifasini brauzerda oching va
  matnni shu suhbatga joylashtiring (yoki skrinshot) — shundan keyin aniq
  integratsiyani yozib beraman; **yoki**
- CLICK guruhidan (yoki ИИ botidan) so'rang: *"bizda ikkita mahsulot — B2B
  agentlik obunasi va B2C foydalanuvchi obunasi — ikkalasi ham 1 xizmat
  (service_id) ostida. Fiskalizatsiya kerakmi, ИКПУ qanday belgilanadi?"*

Fiskalizatsiya hal qilinmaguncha **haqiqiy (production) to'lovlarni
ishga tushirmang** — bu qonuniy talab, texnik emas.

## Ikkinchi to'lov tugmasi — "istalgan kartadan to'lash" (ixtiyoriy, muhokama kerak)

CLICK ikkita web-to'lov variantini tavsiya qiladi, ikkalasini ham
o'rnatishni so'raydi:

1. **CLICK tugmasi** (https://docs.click.uz/click-button/) — CLICK'ga ulangan
   foydalanuvchilar uchun, hisob-faktura asosida; ro'yxatdan o'tmasdan ham
   to'lash mumkin. **Bu — hozir amalga oshirilgan variant**: bizning
   `buildPayUrl()` → `my.click.uz/services/pay` redirect, xuddi shu
   Prepare/Complete Shop API orqali ishlaydi.
2. **"Istalgan kartadan to'lash"** (https://docs.click.uz/click-pay-by-card/)
   — CLICK ilovasiga ulanmagan, lekin kartasi bor har qanday foydalanuvchi
   uchun (karta raqami + muddatini to'g'ridan-to'g'ri kiritadi). Bu —
   ALOHIDA integratsiya (widget/forma), hozir amalga oshirilmagan.

Ikkinchisini ham qo'shishni xohlaysizmi? Xohlasangiz, xuddi fiskalizatsiya
kabi — sahifa matnini (yoki skrinshotini) yuboring, men shu asosda aniq
qilib qo'shib beraman (noaniq API sxemasi bilan to'lov kodini yozish xavfli).

## Ishga tushirishdan oldingi tekshiruv ro'yxati

- [ ] `CLICK_*` kalitlari faqat backend `.env`da
- [ ] `USER_PREMIUM_PRICE_UZS` — haqiqiy narx qo'yilgan
- [ ] Migratsiya SQL prod bazada bajarilgan + `prisma generate`
- [ ] CLICK kabinetida Prepare/Complete URL'lari HTTPS bilan ro'yxatda
- [ ] `travelorai.com` uchun TLS (443) ishlayotgani tasdiqlangan — callback'lar
      HTTP orqali yurmasligi kerak
- [ ] `merchant.click.uz` → Сервисы → xizmat FAOLLASHTIRILGAN (CLICK
      guruhidan tasdiq olingan — default o'chiq turadi)
- [ ] Server IP TAS-IX tarmog'ida, aks holda CLICK'ga oldindan domen/IP/port
      yuborilgan (firewall oq ro'yxati)
- [ ] IP/domen **statik** — o'zgartirishdan oldin CLICK'ga xabar beriladi
- [ ] **Fiskalizatsiya masalasi hal qilingan** (yuqoridagi bo'limga qarang) —
      bu bo'lmasa production'ga chiqmang
- [ ] `JWT_SECRET` ≠ `AGENCY_JWT_SECRET`, ikkalasi ham kuchli tasodifiy qiymat
- [ ] Prod'da default sirlar yo'q (`travelorai_secret`, `change_me` va h.k.)
- [ ] Click Up ilovasi bilan sinov to'lovi (`amount=1000, transaction_param=test`)
      xatosiz o'tgan
- [ ] CLICK test to'lovi: ilovadan to'lash → saytda ko'rinishi; saytdan to'lash
      → ilovada ko'rinishi
- [ ] `ACTIVATION_FAILED` loglariga alert sozlangan (admin panelda ko'rinadi,
      lekin real-time alert — masalan email/Telegram — hali yo'q)
