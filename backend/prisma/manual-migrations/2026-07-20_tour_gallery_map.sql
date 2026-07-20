-- Tur galereyasi + xarita manzili (additive, xavfsiz).
-- Prod DB drift qilgan — `prisma db push` ISHLATILMAYDI, faqat shu raw SQL.
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "mapAddress" TEXT;
