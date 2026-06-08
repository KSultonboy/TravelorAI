ALTER TABLE "Poi"
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "manualBoost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS "landingSortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "landingActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "TourAgency"
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "manualBoost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS "landingSortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "TravelerStory"
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "manualBoost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8;

CREATE TABLE IF NOT EXISTS "LandingInteraction" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "sessionId" TEXT,
  "userId" TEXT,
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LandingInteraction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Poi_featured_idx" ON "Poi"("featured");
CREATE INDEX IF NOT EXISTS "Poi_landingActive_landingSortOrder_idx" ON "Poi"("landingActive", "landingSortOrder");
CREATE INDEX IF NOT EXISTS "TourAgency_featured_idx" ON "TourAgency"("featured");
CREATE INDEX IF NOT EXISTS "TourAgency_landingSortOrder_idx" ON "TourAgency"("landingSortOrder");
CREATE INDEX IF NOT EXISTS "TravelerStory_featured_idx" ON "TravelerStory"("featured");
CREATE INDEX IF NOT EXISTS "LandingInteraction_entityType_entityId_createdAt_idx" ON "LandingInteraction"("entityType", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "LandingInteraction_eventType_createdAt_idx" ON "LandingInteraction"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "LandingInteraction_sessionId_createdAt_idx" ON "LandingInteraction"("sessionId", "createdAt");

UPDATE "Poi"
SET
  "featured" = true,
  "manualBoost" = 5,
  "qualityScore" = GREATEST("confidenceScore", 0.85),
  "landingSortOrder" = CASE "slug"
    WHEN 'registon-maydoni' THEN 1
    WHEN 'ichan-qala' THEN 2
    WHEN 'kalon-minorasi' THEN 3
    WHEN 'chorsu-bozori' THEN 4
    ELSE "landingSortOrder"
  END
WHERE "slug" IN ('registon-maydoni', 'ichan-qala', 'kalon-minorasi', 'chorsu-bozori');

UPDATE "TourAgency"
SET
  "featured" = true,
  "manualBoost" = 3,
  "qualityScore" = GREATEST("confidenceScore", 0.78),
  "landingSortOrder" = CASE "slug"
    WHEN 'silk-road-expeditions' THEN 1
    WHEN 'bukhara-local-guides' THEN 2
    WHEN 'khiva-heritage-tours' THEN 3
    WHEN 'tashkent-city-walks' THEN 4
    ELSE "landingSortOrder"
  END
WHERE "slug" IN ('silk-road-expeditions', 'bukhara-local-guides', 'khiva-heritage-tours', 'tashkent-city-walks');

UPDATE "TravelerStory"
SET
  "featured" = true,
  "manualBoost" = 2,
  "qualityScore" = GREATEST("confidenceScore", 0.82)
WHERE "slug" IN ('xiva-verified-route', 'samarqand-family-trip', 'bukhara-local-tips');
