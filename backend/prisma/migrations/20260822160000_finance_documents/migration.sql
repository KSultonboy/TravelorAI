-- TravelorAI agentlik moliyasi va hujjat reyestri.
-- Idempotent: productiondagi divergent PostgreSQL bazasiga xavfsiz qo'llanadi.

CREATE TABLE IF NOT EXISTS "FinanceAccount" (
  "id" TEXT PRIMARY KEY,
  "agencyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'cash',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "openingBalance" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BusinessDocument" (
  "id" TEXT PRIMARY KEY,
  "agencyId" TEXT NOT NULL,
  "bookingId" TEXT,
  "number" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "title" TEXT NOT NULL,
  "customerName" TEXT,
  "amount" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BusinessDocumentVersion" (
  "id" TEXT PRIMARY KEY,
  "businessDocumentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "content" JSONB NOT NULL,
  "createdByAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "FinanceTransaction" (
  "id" TEXT PRIMARY KEY,
  "agencyId" TEXT NOT NULL,
  "accountId" TEXT,
  "bookingId" TEXT,
  "businessDocumentId" TEXT,
  "direction" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "category" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "counterparty" TEXT,
  "paymentMethod" TEXT,
  "note" TEXT,
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdByAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceAccount_agencyId_name_currency_key" ON "FinanceAccount"("agencyId", "name", "currency");
CREATE INDEX IF NOT EXISTS "FinanceAccount_agencyId_active_idx" ON "FinanceAccount"("agencyId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessDocument_agencyId_number_key" ON "BusinessDocument"("agencyId", "number");
CREATE INDEX IF NOT EXISTS "BusinessDocument_agencyId_type_status_issuedAt_idx" ON "BusinessDocument"("agencyId", "type", "status", "issuedAt");
CREATE INDEX IF NOT EXISTS "BusinessDocument_bookingId_idx" ON "BusinessDocument"("bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessDocumentVersion_businessDocumentId_version_key" ON "BusinessDocumentVersion"("businessDocumentId", "version");
CREATE INDEX IF NOT EXISTS "BusinessDocumentVersion_businessDocumentId_createdAt_idx" ON "BusinessDocumentVersion"("businessDocumentId", "createdAt");
CREATE INDEX IF NOT EXISTS "FinanceTransaction_agencyId_currency_status_dueAt_idx" ON "FinanceTransaction"("agencyId", "currency", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "FinanceTransaction_agencyId_paidAt_idx" ON "FinanceTransaction"("agencyId", "paidAt");
CREATE INDEX IF NOT EXISTS "FinanceTransaction_bookingId_idx" ON "FinanceTransaction"("bookingId");
CREATE INDEX IF NOT EXISTS "FinanceTransaction_accountId_idx" ON "FinanceTransaction"("accountId");
CREATE INDEX IF NOT EXISTS "FinanceTransaction_businessDocumentId_idx" ON "FinanceTransaction"("businessDocumentId");

DO $$ BEGIN
  ALTER TABLE "FinanceAccount" ADD CONSTRAINT "FinanceAccount_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "TourBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BusinessDocumentVersion" ADD CONSTRAINT "BusinessDocumentVersion_businessDocumentId_fkey"
    FOREIGN KEY ("businessDocumentId") REFERENCES "BusinessDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "TourBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_businessDocumentId_fkey"
    FOREIGN KEY ("businessDocumentId") REFERENCES "BusinessDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
