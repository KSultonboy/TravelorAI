-- Tur: transfer va sug'urta belgilari. Additive — mavjud ma'lumotga ta'sir qilmaydi.
--
-- Nega kerak: CRM formasida transfer va sug'urta faqat erkin matnli «xizmatlar»
-- ro'yxatida (highlights) edi. Highlights sayt tur sahifasida ko'rsatilmaydi —
-- shuning uchun mijoz transfer/sug'urta kiritilganini ko'rmasdi. Endi bular
-- mehmonxona/aviabilet kabi alohida belgi (checkbox) bo'ldi va tur sahifasidagi
-- «Nimalar kiritilgan» ro'yxatida chiqadi.

ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "transferIncluded"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "insuranceIncluded" BOOLEAN NOT NULL DEFAULT false;

-- Mavjud turlar: xizmatlar ro'yxatida transfer/sug'urta yozilgan bo'lsa —
-- belgini yoqib qo'yamiz, agent qayta kiritib o'tirmasin.
-- (highlights String[] — massiv ichida qidiramiz, imlo variantlari bilan.)
UPDATE "Tour" t
   SET "transferIncluded" = true
 WHERE t."transferIncluded" = false
   AND EXISTS (
     SELECT 1 FROM unnest(t."highlights") AS h
      WHERE lower(h) LIKE '%transfer%'
   );

UPDATE "Tour" t
   SET "insuranceIncluded" = true
 WHERE t."insuranceIncluded" = false
   AND EXISTS (
     SELECT 1 FROM unnest(t."highlights") AS h
      WHERE lower(h) LIKE '%sug%rta%' OR lower(h) LIKE '%страхов%' OR lower(h) LIKE '%insurance%'
   );
