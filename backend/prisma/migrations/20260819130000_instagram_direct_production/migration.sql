-- Productionda avval manual qo'llangan bo'lishi mumkin, shuning uchun barcha
-- amallar idempotent. Yangi muhitda esa prisma migrate deploy hammasini yaratadi.
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramUserId" TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramAppScopedId" TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramUsername" TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramToken" TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramWelcome" TEXT;
CREATE INDEX IF NOT EXISTS "TourAgency_instagramUserId_idx" ON "TourAgency"("instagramUserId");
CREATE INDEX IF NOT EXISTS "TourAgency_instagramAppScopedId_idx" ON "TourAgency"("instagramAppScopedId");

ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "instagramUserId" TEXT;
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "instagramUsername" TEXT;
CREATE INDEX IF NOT EXISTS "TourBooking_instagramUserId_idx" ON "TourBooking"("instagramUserId");

ALTER TABLE "TelegramMessage" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'telegram';
ALTER TABLE "TelegramMessage" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramMessage_externalId_key" ON "TelegramMessage"("externalId");
