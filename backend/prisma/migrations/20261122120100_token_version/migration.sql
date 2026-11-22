-- JWT bekor qilish (revocation): tokenga "tv" claim yoziladi va auth middleware
-- uni shu ustun bilan solishtiradi. Parol almashtirilganda/tiklanganda oshiriladi.
-- Additive: default 0 — claim'siz eski tokenlar (tv=0 deb hisoblanadi) ishlashda davom etadi.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AgencyAccount"
ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
