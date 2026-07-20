-- Agentlik jamoasi: bir agentlikda bir necha xodim + rollar (additive, xavfsiz).
-- Egasi AgencyMember'da SAQLANMAYDI — u TourAgency.ownerAccountId orqali aniqlanadi.
-- AgencyMember faqat taklif qilingan xodimlarni (manager/agent/accountant) saqlaydi.
CREATE TABLE IF NOT EXISTS "AgencyMember" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'agent',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyMember_agencyId_accountId_key" ON "AgencyMember"("agencyId","accountId");
CREATE INDEX IF NOT EXISTS "AgencyMember_agencyId_idx" ON "AgencyMember"("agencyId");
CREATE INDEX IF NOT EXISTS "AgencyMember_accountId_idx" ON "AgencyMember"("accountId");

DO $$ BEGIN
  ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AgencyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
