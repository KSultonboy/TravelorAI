ALTER TYPE "AuthCodeType" ADD VALUE IF NOT EXISTS 'ACCOUNT_DELETE';

ALTER TABLE "User"
ADD COLUMN "pendingEmail" TEXT,
ADD COLUMN "emailChangeResendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "emailChangeRequestedAt" TIMESTAMP(3),
ADD COLUMN "accountDeleteResendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "accountDeleteRequestedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_pendingEmail_key" ON "User"("pendingEmail");
