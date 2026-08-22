-- Supplier debt, manager commission, partial payments, PDF archive,
-- approval/e-signature and passport OCR metadata.
ALTER TABLE "FinanceTransaction"
  ADD COLUMN "supplierId" TEXT,
  ADD COLUMN "managerMemberId" TEXT,
  ADD COLUMN "commissionSourceId" TEXT;

ALTER TABLE "LeadFile"
  ADD COLUMN "ocrStatus" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "ocrData" JSONB,
  ADD COLUMN "ocrAt" TIMESTAMP(3),
  ADD COLUMN "ocrError" TEXT;

CREATE TABLE "AgencySupplier" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'tour_operator',
  "taxId" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgencySupplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagerCommissionRule" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fixedAmount" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManagerCommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessDocumentPayment" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "businessDocumentId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "createdByAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessDocumentPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessDocumentArchive" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "businessDocumentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "createdByAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessDocumentArchive_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentApproval" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "businessDocumentId" TEXT NOT NULL,
  "requestedById" TEXT,
  "decidedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "comment" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentSignature" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "businessDocumentId" TEXT NOT NULL,
  "signerName" TEXT NOT NULL,
  "signerEmail" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "requestedById" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceTransaction_commissionSourceId_key" ON "FinanceTransaction"("commissionSourceId");
CREATE INDEX "FinanceTransaction_supplierId_idx" ON "FinanceTransaction"("supplierId");
CREATE INDEX "FinanceTransaction_managerMemberId_idx" ON "FinanceTransaction"("managerMemberId");
CREATE UNIQUE INDEX "AgencySupplier_agencyId_name_key" ON "AgencySupplier"("agencyId", "name");
CREATE INDEX "AgencySupplier_agencyId_active_idx" ON "AgencySupplier"("agencyId", "active");
CREATE UNIQUE INDEX "ManagerCommissionRule_memberId_key" ON "ManagerCommissionRule"("memberId");
CREATE INDEX "ManagerCommissionRule_agencyId_active_idx" ON "ManagerCommissionRule"("agencyId", "active");
CREATE UNIQUE INDEX "BusinessDocumentPayment_transactionId_key" ON "BusinessDocumentPayment"("transactionId");
CREATE INDEX "BusinessDocumentPayment_agencyId_paidAt_idx" ON "BusinessDocumentPayment"("agencyId", "paidAt");
CREATE INDEX "BusinessDocumentPayment_businessDocumentId_paidAt_idx" ON "BusinessDocumentPayment"("businessDocumentId", "paidAt");
CREATE INDEX "BusinessDocumentArchive_agencyId_createdAt_idx" ON "BusinessDocumentArchive"("agencyId", "createdAt");
CREATE INDEX "BusinessDocumentArchive_businessDocumentId_version_idx" ON "BusinessDocumentArchive"("businessDocumentId", "version");
CREATE INDEX "DocumentApproval_agencyId_status_createdAt_idx" ON "DocumentApproval"("agencyId", "status", "createdAt");
CREATE INDEX "DocumentApproval_businessDocumentId_createdAt_idx" ON "DocumentApproval"("businessDocumentId", "createdAt");
CREATE INDEX "DocumentSignature_agencyId_status_createdAt_idx" ON "DocumentSignature"("agencyId", "status", "createdAt");
CREATE INDEX "DocumentSignature_businessDocumentId_createdAt_idx" ON "DocumentSignature"("businessDocumentId", "createdAt");
CREATE INDEX "DocumentSignature_signerEmail_expiresAt_idx" ON "DocumentSignature"("signerEmail", "expiresAt");

ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "AgencySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_managerMemberId_fkey" FOREIGN KEY ("managerMemberId") REFERENCES "AgencyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgencySupplier" ADD CONSTRAINT "AgencySupplier_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagerCommissionRule" ADD CONSTRAINT "ManagerCommissionRule_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagerCommissionRule" ADD CONSTRAINT "ManagerCommissionRule_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "AgencyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentPayment" ADD CONSTRAINT "BusinessDocumentPayment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentPayment" ADD CONSTRAINT "BusinessDocumentPayment_businessDocumentId_fkey" FOREIGN KEY ("businessDocumentId") REFERENCES "BusinessDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentPayment" ADD CONSTRAINT "BusinessDocumentPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinanceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentArchive" ADD CONSTRAINT "BusinessDocumentArchive_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentArchive" ADD CONSTRAINT "BusinessDocumentArchive_businessDocumentId_fkey" FOREIGN KEY ("businessDocumentId") REFERENCES "BusinessDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_businessDocumentId_fkey" FOREIGN KEY ("businessDocumentId") REFERENCES "BusinessDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_businessDocumentId_fkey" FOREIGN KEY ("businessDocumentId") REFERENCES "BusinessDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
