-- Structured package details for agency tours. All new fields are nullable/defaulted
-- so existing tours stay intact and can be completed later from the agency panel.
ALTER TABLE "Tour"
  ADD COLUMN IF NOT EXISTS "priceCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "priceBasis" TEXT,
  ADD COLUMN IF NOT EXISTS "departureCity" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationCountry" TEXT,
  ADD COLUMN IF NOT EXISTS "tourGroup" TEXT,
  ADD COLUMN IF NOT EXISTS "nights" INTEGER,
  ADD COLUMN IF NOT EXISTS "hotelIncluded" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "hotelName" TEXT,
  ADD COLUMN IF NOT EXISTS "hotelCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "hotelLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "roomType" TEXT,
  ADD COLUMN IF NOT EXISTS "mealPlan" TEXT,
  ADD COLUMN IF NOT EXISTS "mealPlanLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "childPolicy" TEXT,
  ADD COLUMN IF NOT EXISTS "flightSeatStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "availabilityStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "instantConfirmation" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "stopSale" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "promo" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "priceIncludes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "priceExcludes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Tour"
SET
  "priceIncludes" = COALESCE("priceIncludes", ARRAY[]::TEXT[]),
  "priceExcludes" = COALESCE("priceExcludes", ARRAY[]::TEXT[]),
  "hotelIncluded" = COALESCE("hotelIncluded", FALSE),
  "instantConfirmation" = COALESCE("instantConfirmation", FALSE),
  "stopSale" = COALESCE("stopSale", FALSE),
  "promo" = COALESCE("promo", FALSE);

CREATE INDEX IF NOT EXISTS "Tour_mealPlan_idx" ON "Tour"("mealPlan");
CREATE INDEX IF NOT EXISTS "Tour_hotelCategory_idx" ON "Tour"("hotelCategory");
CREATE INDEX IF NOT EXISTS "Tour_availabilityStatus_idx" ON "Tour"("availabilityStatus");
