-- TravelorAI CRM server foundation (PostgreSQL)
-- Idempotent: productiondagi divergent bazaga qayta ishlatish xavfsiz.

ALTER TABLE "TourBooking"
  ADD COLUMN IF NOT EXISTS "assignedMemberId" TEXT;

CREATE TABLE IF NOT EXISTS "CrmTask" (
  "id" TEXT PRIMARY KEY,
  "agencyId" TEXT NOT NULL,
  "bookingId" TEXT,
  "assignedMemberId" TEXT,
  "createdByAccountId" TEXT,
  "title" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LeadActivity" (
  "id" TEXT PRIMARY KEY,
  "agencyId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "actorAccountId" TEXT,
  "type" TEXT NOT NULL DEFAULT 'note',
  "text" TEXT NOT NULL,
  "metadata" JSONB,
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LeadTag" (
  "id" TEXT PRIMARY KEY,
  "agencyId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "DocumentTemplate" (
  "id" TEXT PRIMARY KEY,
  "agencyId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AgencyRequisite" (
  "id" TEXT PRIMARY KEY,
  "agencyId" TEXT NOT NULL,
  "legalName" TEXT,
  "director" TEXT,
  "address" TEXT,
  "taxId" TEXT,
  "bankName" TEXT,
  "bankAccount" TEXT,
  "mfo" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "extra" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "agencyId" TEXT NOT NULL,
  "actorAccountId" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "requestPath" TEXT,
  "requestMethod" TEXT,
  "changes" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmTask_agencyId_externalId_key" ON "CrmTask"("agencyId", "externalId");
CREATE INDEX IF NOT EXISTS "CrmTask_agencyId_completedAt_dueAt_idx" ON "CrmTask"("agencyId", "completedAt", "dueAt");
CREATE INDEX IF NOT EXISTS "CrmTask_bookingId_idx" ON "CrmTask"("bookingId");
CREATE INDEX IF NOT EXISTS "CrmTask_assignedMemberId_idx" ON "CrmTask"("assignedMemberId");

CREATE UNIQUE INDEX IF NOT EXISTS "LeadActivity_agencyId_externalId_key" ON "LeadActivity"("agencyId", "externalId");
CREATE INDEX IF NOT EXISTS "LeadActivity_agencyId_bookingId_createdAt_idx" ON "LeadActivity"("agencyId", "bookingId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "LeadTag_bookingId_name_key" ON "LeadTag"("bookingId", "name");
CREATE INDEX IF NOT EXISTS "LeadTag_agencyId_name_idx" ON "LeadTag"("agencyId", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTemplate_agencyId_type_key" ON "DocumentTemplate"("agencyId", "type");
CREATE INDEX IF NOT EXISTS "DocumentTemplate_agencyId_idx" ON "DocumentTemplate"("agencyId");

CREATE UNIQUE INDEX IF NOT EXISTS "AgencyRequisite_agencyId_key" ON "AgencyRequisite"("agencyId");
CREATE UNIQUE INDEX IF NOT EXISTS "AuditLog_dedupeKey_key" ON "AuditLog"("dedupeKey");
CREATE INDEX IF NOT EXISTS "AuditLog_agencyId_createdAt_idx" ON "AuditLog"("agencyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_agencyId_entityType_entityId_idx" ON "AuditLog"("agencyId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorAccountId_createdAt_idx" ON "AuditLog"("actorAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "TourBooking_agencyId_assignedMemberId_idx" ON "TourBooking"("agencyId", "assignedMemberId");

DO $$ BEGIN
  ALTER TABLE "TourBooking" ADD CONSTRAINT "TourBooking_assignedMemberId_fkey"
    FOREIGN KEY ("assignedMemberId") REFERENCES "AgencyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "TourBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_assignedMemberId_fkey"
    FOREIGN KEY ("assignedMemberId") REFERENCES "AgencyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "TourBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "TourBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgencyRequisite" ADD CONSTRAINT "AgencyRequisite_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
