-- Lid manbasi (UTM + referrer) — qaysi kanal qancha lid va pul keltirayotganini bilish uchun.
-- Additive, xavfsiz. Prod DB drift qilgan — faqat shu raw SQL.
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "referrer" TEXT;

CREATE INDEX IF NOT EXISTS "TourBooking_agencyId_utmSource_idx" ON "TourBooking"("agencyId","utmSource");
