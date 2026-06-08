CREATE TABLE IF NOT EXISTS "TravelerStory" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "quote" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "avatar" TEXT,
  "avatarColor" TEXT,
  "rating" INTEGER NOT NULL DEFAULT 5,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'admin',
  "sourceUrl" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelerStory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TravelerStory_slug_key" ON "TravelerStory"("slug");
CREATE INDEX IF NOT EXISTS "TravelerStory_active_sortOrder_idx" ON "TravelerStory"("active", "sortOrder");

INSERT INTO "TravelerStory" (
  "id", "slug", "quote", "authorName", "authorRole", "avatar", "avatarColor",
  "rating", "sortOrder", "active", "source", "lastVerifiedAt", "confidenceScore"
) VALUES
  (
    'story_xiva_verified_route',
    'xiva-verified-route',
    'TravelorAI Xiva safarimizni aniqroq qildi: joylar, vaqt va mahalliy maslahatlar bitta rejada chiqdi.',
    'Sarah Jenkins',
    'Uzbekistan traveler',
    'S',
    '#0c8b63',
    5,
    1,
    true,
    'admin',
    CURRENT_TIMESTAMP,
    0.85
  ),
  (
    'story_samarqand_family_trip',
    'samarqand-family-trip',
    'Oilaviy sayohatda eng foydali tomoni: restoran, landmark va transport variantlari bir-biriga mos tartibda ko''rsatildi.',
    'Michael Torres',
    'Family traveler',
    'M',
    '#1f2937',
    5,
    2,
    true,
    'admin',
    CURRENT_TIMESTAMP,
    0.82
  ),
  (
    'story_bukhara_local_tips',
    'bukhara-local-tips',
    'Buxoro bo''yicha tavsiyalar oddiy ro''yxat emas, mahalliy kontekst bilan tushuntirilgani yoqdi.',
    'Emma Watson',
    'Silk Road guest',
    'E',
    '#d8aa53',
    5,
    3,
    true,
    'admin',
    CURRENT_TIMESTAMP,
    0.82
  )
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "TourAgency" (
  "id", "slug", "name", "city", "description", "specialty", "rating", "reviews",
  "toursCount", "active", "source", "lastVerifiedAt", "confidenceScore"
) VALUES
  (
    'agency_silk_road_expeditions',
    'silk-road-expeditions',
    'Silk Road Expeditions',
    'Samarqand',
    'O''zbekiston bo''ylab madaniy va tarixiy yo''nalishlar.',
    'Cultural routes',
    4.9,
    128,
    14,
    true,
    'admin',
    CURRENT_TIMESTAMP,
    0.78
  ),
  (
    'agency_bukhara_local_guides',
    'bukhara-local-guides',
    'Bukhara Local Guides',
    'Buxoro',
    'Buxoro eski shahar, hunarmandchilik va gastronomik marshrutlar.',
    'Local guides',
    4.8,
    96,
    9,
    true,
    'admin',
    CURRENT_TIMESTAMP,
    0.76
  ),
  (
    'agency_khiva_heritage_tours',
    'khiva-heritage-tours',
    'Khiva Heritage Tours',
    'Xiva',
    'Ichan-Qal''a va Xorazm bo''yicha qisqa va chuqur ekskursiyalar.',
    'Heritage tours',
    4.8,
    84,
    8,
    true,
    'admin',
    CURRENT_TIMESTAMP,
    0.76
  ),
  (
    'agency_tashkent_city_walks',
    'tashkent-city-walks',
    'Tashkent City Walks',
    'Toshkent',
    'Toshkent modern shahar, metro va food tour yo''nalishlari.',
    'City walks',
    4.7,
    72,
    7,
    true,
    'admin',
    CURRENT_TIMESTAMP,
    0.74
  )
ON CONFLICT ("slug") DO NOTHING;
