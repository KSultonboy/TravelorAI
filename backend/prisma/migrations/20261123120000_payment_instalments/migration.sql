-- Mijoz to'lov jadvali (avans / bo'lib to'lash / qarzdorlik nazorati).
-- Faqat qo'shuvchi va idempotent: production bazasida drift bor, shuning uchun
-- hamma narsa IF NOT EXISTS bilan yaratiladi, hech narsa o'chirilmaydi.
-- Jadval bog'lanishsiz (FK yo'q) — LeadFile / TourReview kabi.

CREATE TABLE IF NOT EXISTS "PaymentInstalment" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "paidAt" TIMESTAMP(3),
  "paidAmount" INTEGER,
  "financeTransactionId" TEXT,
  "note" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdByAccountId" TEXT,
  "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentInstalment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentInstalment_financeTransactionId_key" ON "PaymentInstalment"("financeTransactionId");
CREATE INDEX IF NOT EXISTS "PaymentInstalment_agencyId_status_dueDate_idx" ON "PaymentInstalment"("agencyId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "PaymentInstalment_bookingId_idx" ON "PaymentInstalment"("bookingId");
