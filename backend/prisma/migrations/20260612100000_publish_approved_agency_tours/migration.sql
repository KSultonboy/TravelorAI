-- Backfill older approved agency tours so the mobile/home public APIs can see them.
UPDATE "TourAgency"
SET
  "active" = TRUE,
  "approvedAt" = COALESCE("approvedAt", "updatedAt"),
  "rejectedAt" = NULL
WHERE "approvalStatus" = 'approved';

UPDATE "Tour"
SET
  "active" = TRUE,
  "badge" = CASE
    WHEN lower(COALESCE("badge", '')) = 'popular' THEN 'Popular'
    ELSE 'Latest'
  END,
  "approvedAt" = COALESCE("approvedAt", "updatedAt"),
  "rejectedAt" = NULL
WHERE "approvalStatus" = 'approved';

UPDATE "TourAgency" AS agency
SET "toursCount" = counts."approvedCount"
FROM (
  SELECT "agencyId", COUNT(*)::INTEGER AS "approvedCount"
  FROM "Tour"
  WHERE "agencyId" IS NOT NULL
    AND "active" = TRUE
    AND "approvalStatus" = 'approved'
  GROUP BY "agencyId"
) AS counts
WHERE agency."id" = counts."agencyId";

UPDATE "TourAgency" AS agency
SET "toursCount" = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM "Tour" AS tour
  WHERE tour."agencyId" = agency."id"
    AND tour."active" = TRUE
    AND tour."approvalStatus" = 'approved'
);
