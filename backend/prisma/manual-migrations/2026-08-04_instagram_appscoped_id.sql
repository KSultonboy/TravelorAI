-- Instagram webhook `recipient.id`da `user_id` (17841…) o'rniga app doirasidagi
-- `id` (27841…) kelishi mumkin. Ikkalasini ham saqlaymiz, webhook ikkalasi
-- bo'yicha qidiradi — aks holda xabar kelsa ham mos agentlik topilmay,
-- webhook jimgina 200 qaytarardi va lid yaratilmasdi.
ALTER TABLE "TourAgency" ADD COLUMN IF NOT EXISTS "instagramAppScopedId" TEXT;
CREATE INDEX IF NOT EXISTS "TourAgency_instagramAppScopedId_idx" ON "TourAgency"("instagramAppScopedId");
