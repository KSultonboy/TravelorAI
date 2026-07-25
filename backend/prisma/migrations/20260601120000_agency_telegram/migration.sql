-- Add telegram contact handle for tour agencies (free user↔agency connection)
ALTER TABLE "TourAgency" ADD COLUMN "telegram" TEXT;

-- Email is now optional for tour booking leads (phone OR email is enough)
ALTER TABLE "TourBooking" ALTER COLUMN "customerEmail" DROP NOT NULL;
