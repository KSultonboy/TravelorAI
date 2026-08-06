-- Traveler Premium (user-level obuna) + CLICK to'lovlarini user'larga ochish.
-- Additive — mavjud ma'lumotga ta'sir qilmaydi.

-- User: premium holati (ilova + sayt uchun yagona manba)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "premiumPlan"  TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "premiumUntil" TIMESTAMP(3);

-- ClickTransaction: endi ikki xil to'lovchi — agency YOKI user
ALTER TABLE "ClickTransaction" ALTER COLUMN "agencyId" DROP NOT NULL;
ALTER TABLE "ClickTransaction" ADD COLUMN IF NOT EXISTS "payerType" TEXT NOT NULL DEFAULT 'agency';
ALTER TABLE "ClickTransaction" ADD COLUMN IF NOT EXISTS "userId"    TEXT;
ALTER TABLE "ClickTransaction" ADD COLUMN IF NOT EXISTS "planSlug"  TEXT;
CREATE INDEX IF NOT EXISTS "ClickTransaction_userId_idx" ON "ClickTransaction"("userId");

-- Yangi jadval: traveler Premium to'lovlari tarixi.
-- userId ON DELETE SET NULL — akkaunt o'chsa ham moliyaviy yozuv qoladi.
CREATE TABLE IF NOT EXISTS "UserPayment" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "userEmail"    TEXT,
  "planSlug"     TEXT,
  "amount"       INTEGER NOT NULL,
  "currency"     TEXT NOT NULL DEFAULT 'UZS',
  "periodMonths" INTEGER NOT NULL DEFAULT 1,
  "method"       TEXT,
  "note"         TEXT,
  "paidAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "UserPayment_userId_idx" ON "UserPayment"("userId");
CREATE INDEX IF NOT EXISTS "UserPayment_paidAt_idx" ON "UserPayment"("paidAt");
