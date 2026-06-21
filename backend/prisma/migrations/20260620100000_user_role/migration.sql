-- User role (traveler | partner | admin) — admin panel JWT auth uchun
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'traveler';
