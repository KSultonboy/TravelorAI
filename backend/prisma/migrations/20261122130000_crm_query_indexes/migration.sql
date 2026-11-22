-- CRM va katalog so'rovlari uchun yetishmayotgan indekslar (faqat qo'shuvchi).
-- Production bazasi migratsiyalardan farq qiladi (drift), shuning uchun har bir
-- indeks ustun MAVJUDLIGI tekshirilgandan keyin `CREATE INDEX IF NOT EXISTS`
-- bilan yaratiladi: qayta ishga tushirish xavfsiz, hech narsa o'chirilmaydi.
-- Indeks nomlari Prisma konvensiyasiga mos — `prisma migrate diff` farq ko'rsatmaydi.

DO $$
BEGIN
  -- Trip(userId): foydalanuvchi sayohatlari ro'yxati
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'Trip' AND column_name = 'userId') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Trip_userId_idx" ON "Trip"("userId")';
  END IF;

  -- TourBooking(agencyId, telegramChatId): Telegram webhook har xabarda lidni shu juftlik bo'yicha qidiradi
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'TourBooking'
        AND column_name IN ('agencyId', 'telegramChatId')) = 2 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "TourBooking_agencyId_telegramChatId_idx" ON "TourBooking"("agencyId", "telegramChatId")';
  END IF;

  -- TourBooking(agencyId, createdAt): CRM ro'yxatlari va hisobotlar sanaga ko'ra tartiblanadi
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'TourBooking'
        AND column_name IN ('agencyId', 'createdAt')) = 2 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "TourBooking_agencyId_createdAt_idx" ON "TourBooking"("agencyId", "createdAt")';
  END IF;

  -- TourBooking(agencyId, pipelineStage, archived): Kanban ustunlari va broadcast filtri
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'TourBooking'
        AND column_name IN ('agencyId', 'pipelineStage', 'archived')) = 3 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "TourBooking_agencyId_pipelineStage_archived_idx" ON "TourBooking"("agencyId", "pipelineStage", "archived")';
  END IF;

  -- WishlistItem(poiId): Poi o'chirilganda ON DELETE SET NULL uchun FK indeksi
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'WishlistItem' AND column_name = 'poiId') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "WishlistItem_poiId_idx" ON "WishlistItem"("poiId")';
  END IF;
END
$$;
