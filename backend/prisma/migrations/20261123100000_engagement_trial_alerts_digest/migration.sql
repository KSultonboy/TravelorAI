-- Engagement: lid xabarnomalari, 14 kunlik sinov muddati va haftalik hisobot.
-- Faqat qo'shuvchi va idempotent: production bazasida drift bor, shuning uchun
-- har bir ustun jadval MAVJUDLIGI tekshirilgandan keyin `ADD COLUMN IF NOT EXISTS`
-- bilan qo'shiladi. Qayta ishga tushirish xavfsiz, hech narsa o'chirilmaydi.
--
-- MUHIM: "trialEndsAt" standart qiymatsiz qo'shiladi — demak MAVJUD barcha
-- agentliklarda NULL bo'ladi (grandfathered, bugungi xatti-harakat saqlanadi).
-- Sinov muddati faqat shu migratsiyadan keyin yaratilgan agentliklarga kod
-- tomonidan qo'yiladi (admin arizani tasdiqlaganda).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = current_schema() AND table_name = 'TourAgency') THEN
    ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
    ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "trialReminderStage" INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = current_schema() AND table_name = 'AgencyCrmSettings') THEN
    ALTER TABLE "AgencyCrmSettings" ADD COLUMN IF NOT EXISTS "leadAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE "AgencyCrmSettings" ADD COLUMN IF NOT EXISTS "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE "AgencyCrmSettings" ADD COLUMN IF NOT EXISTS "weeklyDigestLastSentAt" TIMESTAMP(3);
    ALTER TABLE "AgencyCrmSettings" ADD COLUMN IF NOT EXISTS "digestIdleNotifiedAt" TIMESTAMP(3);
    ALTER TABLE "AgencyCrmSettings" ADD COLUMN IF NOT EXISTS "digestTestDay" TEXT;
    ALTER TABLE "AgencyCrmSettings" ADD COLUMN IF NOT EXISTS "digestTestCount" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;
