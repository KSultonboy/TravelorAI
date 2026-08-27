ALTER TABLE "TourAgency"
  ADD COLUMN IF NOT EXISTS "accessMode" TEXT NOT NULL DEFAULT 'portal';

CREATE INDEX IF NOT EXISTS "TourAgency_accessMode_active_idx"
  ON "TourAgency"("accessMode", "active");
