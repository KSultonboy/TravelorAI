-- Lidga alohida Telegram (@username / link) va WhatsApp (raqam) kontaktlari.
-- Additive. Aloqa tugmalari shu maydonlarni (bo'lmasa — telefonni) ishlatadi.
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "leadTelegram" TEXT;
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "leadWhatsapp" TEXT;
-- Haqiqatda olingan to'lov (to'lovni tasdiqlashda kiritiladi)
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "paidAmount" INTEGER;
