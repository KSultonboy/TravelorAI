-- Keep DB columns in sync with current Prisma schema for production deploys.

ALTER TABLE "Destination"
ADD COLUMN IF NOT EXISTS "flightPrice" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Destination"
ADD COLUMN IF NOT EXISTS "flightDuration" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Destination"
ALTER COLUMN "trainPrice" SET DEFAULT 0;

ALTER TABLE "Destination"
ALTER COLUMN "trainDuration" SET DEFAULT '';

ALTER TABLE "Destination"
ALTER COLUMN "busPrice" SET DEFAULT 0;

ALTER TABLE "Destination"
ALTER COLUMN "busDuration" SET DEFAULT '';

ALTER TABLE "Poi"
ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "Poi"
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

ALTER TABLE "Poi"
ADD COLUMN IF NOT EXISTS "priceLevel" INTEGER;
