ALTER TABLE "Destination"
ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT,
ADD COLUMN IF NOT EXISTS "seasonality" JSONB,
ADD COLUMN IF NOT EXISTS "openingHours" JSONB,
ADD COLUMN IF NOT EXISTS "priceUpdatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "coverageTier" TEXT NOT NULL DEFAULT 'starter';

ALTER TABLE "Poi"
ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER,
ADD COLUMN IF NOT EXISTS "openingHours" JSONB,
ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.55,
ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT,
ADD COLUMN IF NOT EXISTS "duplicateGroupId" TEXT,
ADD COLUMN IF NOT EXISTS "priceUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Poi_confidenceScore_idx" ON "Poi"("confidenceScore");
CREATE INDEX IF NOT EXISTS "Poi_duplicateGroupId_idx" ON "Poi"("duplicateGroupId");

CREATE TABLE IF NOT EXISTS "TransportProvider" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "website" TEXT,
  "supportPhone" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "sourceUrl" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransportProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TransportProvider_slug_key" ON "TransportProvider"("slug");

CREATE TABLE IF NOT EXISTS "TransportRoute" (
  "id" TEXT NOT NULL,
  "fromCity" TEXT NOT NULL,
  "toCity" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "providerId" TEXT,
  "priceMin" INTEGER NOT NULL,
  "priceMax" INTEGER NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "distanceKm" DOUBLE PRECISION,
  "scheduleNote" TEXT NOT NULL,
  "bookingUrl" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "sourceUrl" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
  "whyRecommended" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransportRoute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TransportRoute_fromCity_toCity_idx" ON "TransportRoute"("fromCity", "toCity");
CREATE INDEX IF NOT EXISTS "TransportRoute_mode_idx" ON "TransportRoute"("mode");
CREATE INDEX IF NOT EXISTS "TransportRoute_active_idx" ON "TransportRoute"("active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TransportRoute_providerId_fkey'
  ) THEN
    ALTER TABLE "TransportRoute"
    ADD CONSTRAINT "TransportRoute_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "TransportProvider"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CityPack" (
  "id" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "offlineReady" BOOLEAN NOT NULL DEFAULT false,
  "poiCount" INTEGER NOT NULL DEFAULT 0,
  "destinationCount" INTEGER NOT NULL DEFAULT 0,
  "transportRouteCount" INTEGER NOT NULL DEFAULT 0,
  "emergencyContacts" JSONB,
  "transportNotes" JSONB,
  "sourceSummary" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CityPack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CityPack_city_key" ON "CityPack"("city");
