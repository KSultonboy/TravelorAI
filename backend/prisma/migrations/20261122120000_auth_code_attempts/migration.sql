-- OTP kodlari uchun noto'g'ri urinishlar hisoblagichi (5 tadan keyin kod bekor qilinadi).
-- Additive: mavjud qatorlar 0 bilan to'ldiriladi, eski kod bu ustunni e'tiborsiz qoldiradi.
ALTER TABLE "AuthCode"
ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AgencyAuthCode"
ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
