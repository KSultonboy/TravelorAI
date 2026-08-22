CREATE TABLE "CrmPipelineStage" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hint" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0F5132',
    "position" INTEGER NOT NULL DEFAULT 0,
    "systemType" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmPipelineStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmPipelineStage_agencyId_key_key" ON "CrmPipelineStage"("agencyId", "key");
CREATE INDEX "CrmPipelineStage_agencyId_position_idx" ON "CrmPipelineStage"("agencyId", "position");

ALTER TABLE "CrmPipelineStage"
  ADD CONSTRAINT "CrmPipelineStage_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CrmPipelineStage" ("id", "agencyId", "key", "name", "hint", "color", "position", "systemType", "isSystem")
SELECT
  CONCAT('cps_', SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text || agency."id" || defaults."key") FROM 1 FOR 24)),
  agency."id",
  defaults."key",
  defaults."name",
  defaults."hint",
  defaults."color",
  defaults."position",
  defaults."key",
  true
FROM "TourAgency" AS agency
CROSS JOIN (VALUES
  ('new', 'Yangi', 'Endi kelgan, hali bog''lanilmagan', '#2563EB', 10),
  ('contacted', 'Bog''lanildi', 'Mijoz bilan aloqaga chiqildi', '#0891B2', 20),
  ('quoted', 'Taklif berildi', 'Narx yoki paket taklifi yuborildi', '#CA8A04', 30),
  ('won', 'Kelishildi', 'Mijoz rozi, bandlov tasdiqlandi', '#16A34A', 40),
  ('completed', 'Yakunlandi', 'Sayohat bo''lib o''tdi', '#0F766E', 50),
  ('lost', 'Yo''qotilgan', 'Rad etildi yoki bekor bo''ldi', '#DC2626', 60)
) AS defaults("key", "name", "hint", "color", "position")
ON CONFLICT ("agencyId", "key") DO NOTHING;
