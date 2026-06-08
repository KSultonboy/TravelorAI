DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeedbackCategory') THEN
    CREATE TYPE "FeedbackCategory" AS ENUM ('suggestion', 'complaint', 'bug', 'feature', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Feedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "FeedbackCategory" NOT NULL DEFAULT 'suggestion',
  "subject" TEXT,
  "message" TEXT NOT NULL,
  "contactEmail" TEXT,
  "platform" TEXT,
  "appVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Feedback_userId_fkey'
  ) THEN
    ALTER TABLE "Feedback"
      ADD CONSTRAINT "Feedback_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Feedback_userId_idx" ON "Feedback"("userId");
CREATE INDEX IF NOT EXISTS "Feedback_category_idx" ON "Feedback"("category");
CREATE INDEX IF NOT EXISTS "Feedback_createdAt_idx" ON "Feedback"("createdAt");
