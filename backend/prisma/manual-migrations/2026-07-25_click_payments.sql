-- CLICK (SHOP API) to'lovlari + tariflarning so'mdagi narxi.
-- Additive — mavjud ma'lumotga ta'sir qilmaydi.

-- Tariff: oylik narx so'mda (CLICK/Payme faqat so'mda ishlaydi)
ALTER TABLE "Tariff" ADD COLUMN IF NOT EXISTS "priceMonthlyUzs" INTEGER NOT NULL DEFAULT 0;

-- Yangi jadval: CLICK to'lov tranzaksiyalari
CREATE TABLE IF NOT EXISTS "ClickTransaction" (
  "id"              TEXT PRIMARY KEY,
  "provider"        TEXT NOT NULL DEFAULT 'click',
  "merchantTransId" TEXT NOT NULL,
  "agencyId"        TEXT NOT NULL,
  "tariffId"        TEXT,
  "tariffSlug"      TEXT,
  "amount"          INTEGER NOT NULL,
  "months"          INTEGER NOT NULL DEFAULT 1,
  "state"           TEXT NOT NULL DEFAULT 'created',
  "clickTransId"    TEXT,
  "clickPaydocId"   TEXT,
  "prepareId"       INTEGER,
  "confirmId"       INTEGER,
  "errorNote"       TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "preparedAt"      TIMESTAMP(3),
  "paidAt"          TIMESTAMP(3),
  "cancelledAt"     TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClickTransaction_merchantTransId_key" ON "ClickTransaction"("merchantTransId");
CREATE INDEX IF NOT EXISTS "ClickTransaction_agencyId_idx"     ON "ClickTransaction"("agencyId");
CREATE INDEX IF NOT EXISTS "ClickTransaction_state_idx"        ON "ClickTransaction"("state");
CREATE INDEX IF NOT EXISTS "ClickTransaction_clickTransId_idx" ON "ClickTransaction"("clickTransId");

-- Boshlang'ich so'm narxlari (faqat hali belgilanmagan bo'lsa — 0).
-- Egasi tasdiqlagan narxlar; admin panelda o'zgartirish mumkin.
UPDATE "Tariff" SET "priceMonthlyUzs" =  99000 WHERE "slug" = 'starter'  AND "priceMonthlyUzs" = 0;
UPDATE "Tariff" SET "priceMonthlyUzs" = 299000 WHERE "slug" = 'pro'      AND "priceMonthlyUzs" = 0;
UPDATE "Tariff" SET "priceMonthlyUzs" = 599000 WHERE "slug" = 'business' AND "priceMonthlyUzs" = 0;
