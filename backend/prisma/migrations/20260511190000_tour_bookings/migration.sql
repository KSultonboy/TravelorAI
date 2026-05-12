CREATE TABLE "TourBooking" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "agencyId" TEXT,
    "userId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "travelers" INTEGER NOT NULL DEFAULT 1,
    "travelDate" TIMESTAMP(3),
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalEstimate" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "source" TEXT NOT NULL DEFAULT 'mobile',
    "agencyNote" TEXT,
    "adminNote" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourBooking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TourBooking_tourId_idx" ON "TourBooking"("tourId");
CREATE INDEX "TourBooking_agencyId_status_idx" ON "TourBooking"("agencyId", "status");
CREATE INDEX "TourBooking_userId_createdAt_idx" ON "TourBooking"("userId", "createdAt");
CREATE INDEX "TourBooking_status_createdAt_idx" ON "TourBooking"("status", "createdAt");
CREATE INDEX "TourBooking_customerEmail_idx" ON "TourBooking"("customerEmail");

ALTER TABLE "TourBooking" ADD CONSTRAINT "TourBooking_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TourBooking" ADD CONSTRAINT "TourBooking_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TourBooking" ADD CONSTRAINT "TourBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
