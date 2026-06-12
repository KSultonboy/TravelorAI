-- AgencyAccount.googleId (prod DB da allaqachon bor bo'lishi mumkin)
ALTER TABLE "AgencyAccount" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyAccount_googleId_key" ON "AgencyAccount"("googleId");
