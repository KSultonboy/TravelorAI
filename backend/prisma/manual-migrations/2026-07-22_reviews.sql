-- Sharh -> reyting (review flywheel). Additive — mavjud ma'lumotга ta'sir qilmaydi.

-- Yangi jadval: mijoz sharhlari
CREATE TABLE IF NOT EXISTS "TourReview" (
  "id"             TEXT PRIMARY KEY,
  "agencyId"       TEXT NOT NULL,
  "bookingId"      TEXT,
  "rating"         INTEGER NOT NULL,
  "text"           TEXT,
  "customerName"   TEXT,
  "telegramChatId" TEXT,
  "status"         TEXT NOT NULL DEFAULT 'published',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TourReview_bookingId_key" ON "TourReview"("bookingId");
CREATE INDEX IF NOT EXISTS "TourReview_agencyId_status_idx" ON "TourReview"("agencyId", "status");

-- TourBooking: baho so'rovi holati
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "reviewRequestedAt"  TIMESTAMP(3);
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "reviewAwaitingText" BOOLEAN NOT NULL DEFAULT false;
