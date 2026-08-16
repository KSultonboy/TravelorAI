-- Lidlarni arxivlash. Additive. Arxivlangan lid kanbandan chiqadi, lekin
-- mijozlar bazasi va hisobotlarda qoladi (tarix yo'qolmaydi).
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "TourBooking_agency_archived_idx" ON "TourBooking"("agencyId", "archived");
