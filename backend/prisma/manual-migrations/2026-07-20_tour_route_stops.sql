-- Marshrut nuqtalari: [{name, lat, lng}] — taklif sahifasida chiziq bilan bog'lanadi (additive).
-- Prod DB drift qilgan — `prisma db push` ISHLATILMAYDI, faqat shu raw SQL.
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "routeStops" JSONB;
