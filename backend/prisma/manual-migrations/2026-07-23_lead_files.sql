-- Lidga fayl biriktirish. Fayl DB'da (bytea) — PII, ochiq statik yo'lda EMAS.
-- Additive — mavjud ma'lumotга ta'sir qilmaydi.

CREATE TABLE IF NOT EXISTS "LeadFile" (
  "id"        TEXT PRIMARY KEY,
  "agencyId"  TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "mimeType"  TEXT NOT NULL,
  "size"      INTEGER NOT NULL,
  "data"      BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LeadFile_bookingId_idx" ON "LeadFile"("bookingId");
CREATE INDEX IF NOT EXISTS "LeadFile_agencyId_idx" ON "LeadFile"("agencyId");
