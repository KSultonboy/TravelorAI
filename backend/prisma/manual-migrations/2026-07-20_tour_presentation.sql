-- Dinamik taklif (prezentatsiya) + ochilish kuzatuvi (additive, xavfsiz).
-- Prod DB drift qilgan — `prisma db push` ISHLATILMAYDI, faqat shu raw SQL.
CREATE TABLE IF NOT EXISTS "TourPresentation" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "bookingId" TEXT,
  "tourId" TEXT,
  "title" TEXT NOT NULL,
  "customerName" TEXT,
  "priceText" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "openCount" INTEGER NOT NULL DEFAULT 0,
  "firstOpenedAt" TIMESTAMP(3),
  "lastOpenedAt" TIMESTAMP(3),
  "interestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourPresentation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TourPresentation_token_key" ON "TourPresentation"("token");
CREATE INDEX IF NOT EXISTS "TourPresentation_agencyId_createdAt_idx" ON "TourPresentation"("agencyId","createdAt");
CREATE INDEX IF NOT EXISTS "TourPresentation_bookingId_idx" ON "TourPresentation"("bookingId");
CREATE INDEX IF NOT EXISTS "TourPresentation_tourId_idx" ON "TourPresentation"("tourId");

DO $$ BEGIN
  ALTER TABLE "TourPresentation" ADD CONSTRAINT "TourPresentation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TourPresentation" ADD CONSTRAINT "TourPresentation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "TourBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TourPresentation" ADD CONSTRAINT "TourPresentation_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
