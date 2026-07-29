-- Instagram Direct → lid integratsiyasi. Hammasi additive: mavjud ma'lumot
-- o'zgarmaydi, hech qanday ustun o'chirilmaydi/nomlanmaydi.
--
-- Nega Telegram'nikidan alohida: Instagram OAuth bilan ulanadi (token 60 kunda
-- tugaydi va yangilanishi kerak), Telegram esa bot tokeni bilan — muddatsiz.
-- Shuning uchun expiry ustuni faqat Instagram'da bor.

-- ── Agentlik: Instagram biznes akkaunt ulanishi ────────────────────────────
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramUserId"         TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramUsername"       TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramToken"          TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramActive"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramWelcome"        TEXT;

-- Webhook kelganda "bu xabar qaysi agentlikniki?" degan savolga IG akkaunt id
-- orqali javob beramiz — indekssiz har xabarda to'liq skan bo'lardi.
CREATE INDEX IF NOT EXISTS "TourAgency_instagramUserId_idx" ON "TourAgency" ("instagramUserId");

-- ── Lid: mijozning Instagram-scoped id'si (IGSID) ─────────────────────────
-- IGSID app+akkaunt juftligiga bog'liq, ya'ni bu mijozning ochiq profili emas.
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "instagramUserId"   TEXT;
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "instagramUsername" TEXT;
CREATE INDEX IF NOT EXISTS "TourBooking_instagramUserId_idx" ON "TourBooking" ("instagramUserId");

-- ── Xabarlar: bitta jadval ikkala kanalga xizmat qiladi ───────────────────
-- TelegramMessage nomi tarixiy — endi u umumiy xabar jurnali. Prod bazasi
-- divergent, jadvalni qayta nomlash xavfli; shuning uchun nomi qoladi, ustun
-- qo'shiladi. DEFAULT 'telegram' — mavjud yozuvlar avtomatik to'g'ri belgilanadi.
ALTER TABLE "TelegramMessage" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'telegram';
