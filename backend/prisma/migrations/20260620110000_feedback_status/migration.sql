-- Feedback status (new | resolved) — admin feedback inbox uchun
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'new';
