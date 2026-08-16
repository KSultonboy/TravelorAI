-- Admin CRM: tariflar, obunalar, to'lovlar (additive, xavfsiz)
CREATE TABLE IF NOT EXISTS "Tariff" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "priceMonthly" INTEGER NOT NULL DEFAULT 0,
  "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "features" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tariff_slug_key" ON "Tariff"("slug");
CREATE INDEX IF NOT EXISTS "Tariff_active_idx" ON "Tariff"("active");
CREATE INDEX IF NOT EXISTS "Tariff_sortOrder_idx" ON "Tariff"("sortOrder");

CREATE TABLE IF NOT EXISTS "AgencyPayment" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "tariffId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "periodMonths" INTEGER NOT NULL DEFAULT 1,
  "method" TEXT,
  "note" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgencyPayment_agencyId_idx" ON "AgencyPayment"("agencyId");
CREATE INDEX IF NOT EXISTS "AgencyPayment_tariffId_idx" ON "AgencyPayment"("tariffId");
CREATE INDEX IF NOT EXISTS "AgencyPayment_paidAt_idx" ON "AgencyPayment"("paidAt");

ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "tariffId" TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "subscriptionUntil" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "TourAgency_tariffId_idx" ON "TourAgency"("tariffId");
CREATE INDEX IF NOT EXISTS "TourAgency_subscriptionStatus_idx" ON "TourAgency"("subscriptionStatus");

-- FK constraints (idempotent)
DO $$ BEGIN
  ALTER TABLE "TourAgency" ADD CONSTRAINT "TourAgency_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AgencyPayment" ADD CONSTRAINT "AgencyPayment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AgencyPayment" ADD CONSTRAINT "AgencyPayment_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Standart tariflar (agar bo'sh bo'lsa)
INSERT INTO "Tariff" ("id","name","slug","priceMonthly","commissionPct","features","sortOrder","active","createdAt","updatedAt")
SELECT 'trf_starter','Boshlang''ich','starter',9,15,'Marketplace leadlari|Asosiy pipeline|1 foydalanuvchi',1,true,now(),now()
WHERE NOT EXISTS (SELECT 1 FROM "Tariff");
INSERT INTO "Tariff" ("id","name","slug","priceMonthly","commissionPct","features","sortOrder","active","createdAt","updatedAt")
SELECT 'trf_pro','Pro','pro',29,15,'Cheksiz + qo''lda leadlar|Vazifa va eslatmalar|Analitika + CSV',2,true,now(),now()
WHERE NOT EXISTS (SELECT 1 FROM "Tariff" WHERE "slug"='pro');
INSERT INTO "Tariff" ("id","name","slug","priceMonthly","commissionPct","features","sortOrder","active","createdAt","updatedAt")
SELECT 'trf_business','Business','business',49,15,'Pro hammasi|Jamoa + rollar|Integratsiyalar|Ustuvor qo''llab-quvvatlash',3,true,now(),now()
WHERE NOT EXISTS (SELECT 1 FROM "Tariff" WHERE "slug"='business');
INSERT INTO "Tariff" ("id","name","slug","priceMonthly","commissionPct","features","sortOrder","active","createdAt","updatedAt")
SELECT 'trf_enterprise','Enterprise','enterprise',0,15,'Yirik tarmoqlar|Kelishiladi ($49+)|Maxsus integratsiya',4,true,now(),now()
WHERE NOT EXISTS (SELECT 1 FROM "Tariff" WHERE "slug"='enterprise');
