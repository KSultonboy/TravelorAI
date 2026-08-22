-- Rahbar moliya paneli: filiallar, P&L/cashflow kesimi va menejer payroll.
-- Production bazadagi divergent holat uchun idempotent yozilgan.

CREATE TABLE IF NOT EXISTS "AgencyBranch" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "address" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyBranch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ManagerPayrollProfile" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "baseSalary" INTEGER NOT NULL DEFAULT 0,
  "bonusPerWon" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "payoutDay" INTEGER NOT NULL DEFAULT 5,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagerPayrollProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AgencyMember" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "FinanceAccount" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "FinanceTransaction" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AgencyBranch_agencyId_name_key" ON "AgencyBranch"("agencyId", "name");
CREATE INDEX IF NOT EXISTS "AgencyBranch_agencyId_active_idx" ON "AgencyBranch"("agencyId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "ManagerPayrollProfile_memberId_key" ON "ManagerPayrollProfile"("memberId");
CREATE INDEX IF NOT EXISTS "ManagerPayrollProfile_agencyId_active_idx" ON "ManagerPayrollProfile"("agencyId", "active");
CREATE INDEX IF NOT EXISTS "AgencyMember_agencyId_branchId_idx" ON "AgencyMember"("agencyId", "branchId");
CREATE INDEX IF NOT EXISTS "TourBooking_agencyId_branchId_idx" ON "TourBooking"("agencyId", "branchId");
CREATE INDEX IF NOT EXISTS "FinanceAccount_agencyId_branchId_idx" ON "FinanceAccount"("agencyId", "branchId");
CREATE INDEX IF NOT EXISTS "FinanceTransaction_agencyId_branchId_idx" ON "FinanceTransaction"("agencyId", "branchId");

DO $$ BEGIN
  ALTER TABLE "AgencyBranch" ADD CONSTRAINT "AgencyBranch_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ManagerPayrollProfile" ADD CONSTRAINT "ManagerPayrollProfile_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ManagerPayrollProfile" ADD CONSTRAINT "ManagerPayrollProfile_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "AgencyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "AgencyBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TourBooking" ADD CONSTRAINT "TourBooking_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "AgencyBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FinanceAccount" ADD CONSTRAINT "FinanceAccount_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "AgencyBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "AgencyBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

