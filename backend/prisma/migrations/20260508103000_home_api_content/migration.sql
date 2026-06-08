CREATE TABLE IF NOT EXISTS "TourAgency" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "description" TEXT,
  "specialty" TEXT NOT NULL,
  "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reviews" INTEGER NOT NULL DEFAULT 0,
  "toursCount" INTEGER NOT NULL DEFAULT 0,
  "phone" TEXT,
  "website" TEXT,
  "imageUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'admin',
  "sourceUrl" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourAgency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TourAgency_slug_key" ON "TourAgency"("slug");
CREATE INDEX IF NOT EXISTS "TourAgency_active_idx" ON "TourAgency"("active");
CREATE INDEX IF NOT EXISTS "TourAgency_city_idx" ON "TourAgency"("city");
CREATE INDEX IF NOT EXISTS "TourAgency_rating_idx" ON "TourAgency"("rating");

CREATE TABLE IF NOT EXISTS "Tour" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "subtitle" TEXT NOT NULL,
  "description" TEXT,
  "duration" TEXT NOT NULL,
  "price" TEXT,
  "priceMin" INTEGER,
  "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "badge" TEXT NOT NULL DEFAULT 'Latest',
  "imageUrl" TEXT,
  "itinerary" JSONB,
  "highlights" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "agencyId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'admin',
  "sourceUrl" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tour_slug_key" ON "Tour"("slug");
CREATE INDEX IF NOT EXISTS "Tour_active_idx" ON "Tour"("active");
CREATE INDEX IF NOT EXISTS "Tour_badge_idx" ON "Tour"("badge");
CREATE INDEX IF NOT EXISTS "Tour_city_idx" ON "Tour"("city");
CREATE INDEX IF NOT EXISTS "Tour_rating_idx" ON "Tour"("rating");
CREATE INDEX IF NOT EXISTS "Tour_agencyId_idx" ON "Tour"("agencyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Tour_agencyId_fkey'
  ) THEN
    ALTER TABLE "Tour"
    ADD CONSTRAINT "Tour_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
