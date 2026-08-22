CREATE TABLE "BankStatementImport" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "accountId" TEXT,
  "fileName" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "status" TEXT NOT NULL DEFAULT 'processed',
  "headers" JSONB NOT NULL,
  "mapping" JSONB NOT NULL,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "suggestedRows" INTEGER NOT NULL DEFAULT 0,
  "matchedRows" INTEGER NOT NULL DEFAULT 0,
  "ignoredRows" INTEGER NOT NULL DEFAULT 0,
  "createdByAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankStatementRow" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "direction" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "counterparty" TEXT,
  "description" TEXT,
  "externalId" TEXT,
  "fingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'unmatched',
  "suggestedTransactionId" TEXT,
  "matchedTransactionId" TEXT,
  "matchScore" INTEGER,
  "raw" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankStatementRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankStatementImport_agencyId_createdAt_idx" ON "BankStatementImport"("agencyId", "createdAt");
CREATE INDEX "BankStatementImport_accountId_createdAt_idx" ON "BankStatementImport"("accountId", "createdAt");
CREATE UNIQUE INDEX "BankStatementRow_importId_rowNumber_key" ON "BankStatementRow"("importId", "rowNumber");
CREATE INDEX "BankStatementRow_agencyId_status_idx" ON "BankStatementRow"("agencyId", "status");
CREATE INDEX "BankStatementRow_agencyId_fingerprint_idx" ON "BankStatementRow"("agencyId", "fingerprint");
CREATE INDEX "BankStatementRow_suggestedTransactionId_idx" ON "BankStatementRow"("suggestedTransactionId");
CREATE INDEX "BankStatementRow_matchedTransactionId_idx" ON "BankStatementRow"("matchedTransactionId");

ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankStatementRow" ADD CONSTRAINT "BankStatementRow_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankStatementRow" ADD CONSTRAINT "BankStatementRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankStatementRow" ADD CONSTRAINT "BankStatementRow_suggestedTransactionId_fkey" FOREIGN KEY ("suggestedTransactionId") REFERENCES "FinanceTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankStatementRow" ADD CONSTRAINT "BankStatementRow_matchedTransactionId_fkey" FOREIGN KEY ("matchedTransactionId") REFERENCES "FinanceTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
