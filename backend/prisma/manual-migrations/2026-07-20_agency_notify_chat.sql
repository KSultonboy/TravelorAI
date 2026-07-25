-- Agentga Telegram xabarnomasi yuboriladigan chat (mijoz lidi emas, agentning o'zi).
-- Additive, xavfsiz. Prod DB drift qilgan — faqat shu raw SQL.
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "notifyChatId" TEXT;
