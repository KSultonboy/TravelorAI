-- Tour form v2: from/to dropdowns, nights+days, hotel/flight checkboxes, discount, price basis people, price lock
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "days" INTEGER;
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "flightIncluded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "discount" TEXT;
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "priceBasisPeople" INTEGER;
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "priceLockMinutes" INTEGER;
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "priceLockUntil" TIMESTAMP(3);
