ALTER TYPE "AuthCodeType" ADD VALUE IF NOT EXISTS 'EMAIL_CHANGE';

ALTER TABLE "AgencyAccount"
  ADD COLUMN IF NOT EXISTS "pendingEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "emailChangeResendCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "emailChangeRequestedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "AgencyAccount_pendingEmail_key"
  ON "AgencyAccount"("pendingEmail");

ALTER TABLE "AgencyApplication"
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

ALTER TABLE "Tour"
  ADD COLUMN IF NOT EXISTS "responseTimeMinutes" INTEGER NOT NULL DEFAULT 45;

ALTER TABLE "TourBooking"
  ADD COLUMN IF NOT EXISTS "responseDeadlineAt" TIMESTAMP(3);

UPDATE "TourBooking" AS booking
SET "responseDeadlineAt" =
  booking."createdAt" + make_interval(mins => COALESCE(tour."responseTimeMinutes", 45))
FROM "Tour" AS tour
WHERE booking."tourId" = tour."id"
  AND booking."responseDeadlineAt" IS NULL;
