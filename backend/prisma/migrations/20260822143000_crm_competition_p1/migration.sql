ALTER TABLE "TourAgency"
  ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappWabaId" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappDisplayPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappToken" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "whatsappWelcome" TEXT;

ALTER TABLE "TourBooking"
  ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slaBreachedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slaReminderAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "whatsappWaId" TEXT,
  ADD COLUMN IF NOT EXISTS "csvImportBatchId" TEXT;

ALTER TABLE "TelegramMessage"
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "senderId" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientId" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE TABLE IF NOT EXISTS "AgencyCrmSettings" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "firstResponseMinutes" INTEGER NOT NULL DEFAULT 30,
  "autoAssignEnabled" BOOLEAN NOT NULL DEFAULT false,
  "roundRobinCursor" INTEGER NOT NULL DEFAULT 0,
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgencyCrmSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgencyCrmSettings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CsvImportBatch" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "actorAccountId" TEXT,
  "fileName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'committed',
  "totalRows" INTEGER NOT NULL,
  "importedRows" INTEGER NOT NULL,
  "duplicateRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0,
  "mapping" JSONB,
  "preview" JSONB,
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CsvImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CsvImportBatch_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgencyCrmSettings_agencyId_key" ON "AgencyCrmSettings"("agencyId");
CREATE INDEX IF NOT EXISTS "CsvImportBatch_agencyId_createdAt_idx" ON "CsvImportBatch"("agencyId", "createdAt");
CREATE INDEX IF NOT EXISTS "CsvImportBatch_agencyId_status_idx" ON "CsvImportBatch"("agencyId", "status");
CREATE INDEX IF NOT EXISTS "TourAgency_whatsappPhoneNumberId_idx" ON "TourAgency"("whatsappPhoneNumberId");
CREATE INDEX IF NOT EXISTS "TourBooking_whatsappWaId_idx" ON "TourBooking"("whatsappWaId");
CREATE INDEX IF NOT EXISTS "TourBooking_agencyId_firstResponseAt_createdAt_idx" ON "TourBooking"("agencyId", "firstResponseAt", "createdAt");
CREATE INDEX IF NOT EXISTS "TourBooking_csvImportBatchId_idx" ON "TourBooking"("csvImportBatchId");
CREATE INDEX IF NOT EXISTS "TelegramMessage_agencyId_channel_createdAt_idx" ON "TelegramMessage"("agencyId", "channel", "createdAt");

DO $$ BEGIN
  ALTER TABLE "TourBooking" ADD CONSTRAINT "TourBooking_csvImportBatchId_fkey"
    FOREIGN KEY ("csvImportBatchId") REFERENCES "CsvImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
