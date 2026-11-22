-- Distribution: public storefront /a/[slug], Telegram kanalga tur joylash,
-- taklif sahifasidagi agentlik to'lov havolasi. Faqat qo'shuvchi (additive),
-- qayta ishga tushirilsa ham xavfsiz (IF NOT EXISTS / DO $$ guard'lar).
-- Prod DB drift qilgan: TourPresentation jadvali faqat manual-migrations'da
-- yaratilgan, shuning uchun unga tegishli ALTER'lar jadval borligini tekshiradi.

-- 1) Agentlik: Telegram kanal + to'lov havolasi / rekvizitlar
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "telegramChannelId" TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "telegramChannelTitle" TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "telegramChannelUsername" TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "paymentLinkUrl" TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "paymentRequisitesText" TEXT;

-- 2) Taklif: «To'lash» tugmasi bosilishi (payment_clicked hodisasi)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'TourPresentation'
  ) THEN
    ALTER TABLE "TourPresentation" ADD COLUMN IF NOT EXISTS "paymentClickCount" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "TourPresentation" ADD COLUMN IF NOT EXISTS "paymentClickedAt" TIMESTAMP(3);
  END IF;
END $$;

-- 3) Kanalga joylash tarixi
CREATE TABLE IF NOT EXISTS "TourChannelPost" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedByAccountId" TEXT,
  CONSTRAINT "TourChannelPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TourChannelPost_agencyId_tourId_postedAt_idx"
  ON "TourChannelPost"("agencyId", "tourId", "postedAt");

DO $$ BEGIN
  ALTER TABLE "TourChannelPost" ADD CONSTRAINT "TourChannelPost_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TourChannelPost" ADD CONSTRAINT "TourChannelPost_tourId_fkey"
    FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
