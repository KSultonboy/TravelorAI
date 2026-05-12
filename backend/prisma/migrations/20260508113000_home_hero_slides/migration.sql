CREATE TABLE IF NOT EXISTS "HomeHeroSlide" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "imageUrl" TEXT NOT NULL,
  "actionUrl" TEXT,
  "placeSlug" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'admin',
  "sourceUrl" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeHeroSlide_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HomeHeroSlide_slug_key" ON "HomeHeroSlide"("slug");
CREATE INDEX IF NOT EXISTS "HomeHeroSlide_active_sortOrder_idx" ON "HomeHeroSlide"("active", "sortOrder");
