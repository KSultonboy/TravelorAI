ALTER TABLE "AgencyAccount"
  ADD COLUMN IF NOT EXISTS "googleId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AgencyAccount_googleId_key"
  ON "AgencyAccount"("googleId");
