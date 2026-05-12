-- Agency onboarding + tour review workflow.

CREATE TABLE IF NOT EXISTS "AgencyAccount" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "emailVerifiedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgencyAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgencyAccount_email_key" ON "AgencyAccount"("email");
CREATE INDEX IF NOT EXISTS "AgencyAccount_status_idx" ON "AgencyAccount"("status");
CREATE INDEX IF NOT EXISTS "AgencyAccount_emailVerified_idx" ON "AgencyAccount"("emailVerified");

CREATE TABLE IF NOT EXISTS "AgencyAuthCode" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "type" "AuthCodeType" NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyAuthCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgencyAuthCode_accountId_type_idx" ON "AgencyAuthCode"("accountId", "type");
CREATE INDEX IF NOT EXISTS "AgencyAuthCode_expiresAt_idx" ON "AgencyAuthCode"("expiresAt");

CREATE TABLE IF NOT EXISTS "AgencyApplication" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "agencyId" TEXT,
  "companyName" TEXT NOT NULL,
  "legalName" TEXT,
  "contactPerson" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'Global',
  "website" TEXT,
  "telegram" TEXT,
  "instagram" TEXT,
  "serviceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "description" TEXT NOT NULL,
  "documents" JSONB,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "adminNote" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgencyApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgencyApplication_accountId_idx" ON "AgencyApplication"("accountId");
CREATE INDEX IF NOT EXISTS "AgencyApplication_agencyId_idx" ON "AgencyApplication"("agencyId");
CREATE INDEX IF NOT EXISTS "AgencyApplication_status_submittedAt_idx" ON "AgencyApplication"("status", "submittedAt");

ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "ownerAccountId" TEXT;
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "adminNote" TEXT;

ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "adminNote" TEXT;

CREATE INDEX IF NOT EXISTS "TourAgency_ownerAccountId_idx" ON "TourAgency"("ownerAccountId");
CREATE INDEX IF NOT EXISTS "TourAgency_approvalStatus_idx" ON "TourAgency"("approvalStatus");
CREATE INDEX IF NOT EXISTS "Tour_approvalStatus_idx" ON "Tour"("approvalStatus");
CREATE INDEX IF NOT EXISTS "Tour_active_approvalStatus_idx" ON "Tour"("active", "approvalStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AgencyAuthCode_accountId_fkey'
  ) THEN
    ALTER TABLE "AgencyAuthCode"
      ADD CONSTRAINT "AgencyAuthCode_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "AgencyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AgencyApplication_accountId_fkey'
  ) THEN
    ALTER TABLE "AgencyApplication"
      ADD CONSTRAINT "AgencyApplication_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "AgencyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AgencyApplication_agencyId_fkey'
  ) THEN
    ALTER TABLE "AgencyApplication"
      ADD CONSTRAINT "AgencyApplication_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TourAgency_ownerAccountId_fkey'
  ) THEN
    ALTER TABLE "TourAgency"
      ADD CONSTRAINT "TourAgency_ownerAccountId_fkey"
      FOREIGN KEY ("ownerAccountId") REFERENCES "AgencyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "TourAgency"
SET "approvalStatus" = 'approved'
WHERE "approvalStatus" IS NULL OR "approvalStatus" = '';

UPDATE "Tour"
SET "approvalStatus" = 'approved'
WHERE "approvalStatus" IS NULL OR "approvalStatus" = '';
