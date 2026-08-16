-- Login lockout + failed-attempt tracking on User
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lockoutUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lockoutLevel" INTEGER NOT NULL DEFAULT 0;

-- Same protection for agency portal accounts
ALTER TABLE "AgencyAccount"
ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lockoutUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lockoutLevel" INTEGER NOT NULL DEFAULT 0;
