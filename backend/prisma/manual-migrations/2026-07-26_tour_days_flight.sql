-- Tur: kun soni va aviabilet belgisi. Additive — mavjud ma'lumotga ta'sir qilmaydi.
--
-- Nega kerak: website Tour tipida `days` va `flightIncluded` bor va katalog
-- filtri («1-3 / 4-7 / 7+ kun») hamda tur sahifasidagi «Nimalar kiritilgan»
-- shu maydonlarga qaraydi — lekin bazada ustunlar YO'Q edi, ya'ni hech qachon
-- ishlamagan (filtr davomiylik MATNINI parse qilib chiqardi).

ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "days"           INTEGER;
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "flightIncluded" BOOLEAN NOT NULL DEFAULT false;

-- Mavjud turlar: davomiylik matnidagi birinchi sondan kun sonini to'ldiramiz
-- (masalan "5 kun 4 kecha" -> 5). Faqat days bo'sh bo'lganlar uchun.
UPDATE "Tour"
   SET "days" = NULLIF(regexp_replace("duration", '\D.*$', '', 'g'), '')::INTEGER
 WHERE "days" IS NULL
   AND "duration" ~ '^\s*\d+';
