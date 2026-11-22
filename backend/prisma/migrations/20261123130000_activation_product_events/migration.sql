-- Activation & product analytics (additive, idempotent).

-- 1) Server-side product funnel events. No FK on agencyId: funnel history
--    must survive agency deletion and prod DB has drift.
CREATE TABLE IF NOT EXISTS "ProductEvent" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "agencyId"  TEXT,
  "userId"    TEXT,
  "props"     JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductEvent_name_createdAt_idx"
  ON "ProductEvent"("name", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductEvent_agencyId_createdAt_idx"
  ON "ProductEvent"("agencyId", "createdAt");

-- 2) Advanced modules flag. Existing agencies keep everything (TRUE);
--    rows created after this migration default to FALSE (admin enables).
--    The column is added with DEFAULT TRUE (backfills existing rows), then the
--    default is switched to FALSE. Guarded so a re-run never resets values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'TourAgency'
      AND column_name = 'advancedFeatures'
  ) THEN
    ALTER TABLE "TourAgency" ADD COLUMN "advancedFeatures" BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE "TourAgency" ALTER COLUMN "advancedFeatures" SET DEFAULT FALSE;
  END IF;
END $$;

-- 3) Activation checklist dismissal (stored server-side, per agency).
ALTER TABLE "TourAgency"
  ADD COLUMN IF NOT EXISTS "activationDismissedAt" TIMESTAMP(3);
