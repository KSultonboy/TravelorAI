-- Lid maydonlarini tahrirlash: qo'lda kiritiladigan shahar ustuni.
-- Additive — boshqa maydonlar (email, telefon, tur, sana, summa, tug'ilgan kun) allaqachon bor.
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "leadCity" TEXT;
