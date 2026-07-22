-- Tug'ilgan kun tabrigi + sayohat eslatmasi (additive, xavfsiz).
-- Prod DB drift qilgan — `prisma db push` ISHLATILMAYDI, faqat shu raw SQL.
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "customerBirthday" TIMESTAMP(3);
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "birthdayGreetedOn" TEXT;
ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "tripReminderSentAt" TIMESTAMP(3);
