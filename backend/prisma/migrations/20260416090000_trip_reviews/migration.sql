-- Store mobile trip reviews in the backend instead of device-local storage only.

CREATE TABLE IF NOT EXISTS "TripReview" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TripReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TripReview_userId_tripId_key" ON "TripReview"("userId", "tripId");
CREATE INDEX IF NOT EXISTS "TripReview_tripId_createdAt_idx" ON "TripReview"("tripId", "createdAt");
CREATE INDEX IF NOT EXISTS "TripReview_userId_createdAt_idx" ON "TripReview"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'TripReview_userId_fkey'
  ) THEN
    ALTER TABLE "TripReview"
      ADD CONSTRAINT "TripReview_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'TripReview_tripId_fkey'
  ) THEN
    ALTER TABLE "TripReview"
      ADD CONSTRAINT "TripReview_tripId_fkey"
      FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
