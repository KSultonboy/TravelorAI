-- Ensure approved tours without uploaded covers still render with a useful image in mobile/web.
UPDATE "Tour"
SET "imageUrl" = 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1400&q=80'
WHERE "approvalStatus" = 'approved'
  AND ("imageUrl" IS NULL OR trim("imageUrl") = '')
  AND (
    lower(COALESCE("title", '')) LIKE '%dubai%'
    OR lower(COALESCE("title", '')) LIKE '%dubay%'
    OR lower(COALESCE("city", '')) LIKE '%dubai%'
    OR lower(COALESCE("city", '')) LIKE '%dubay%'
    OR lower(COALESCE("city", '')) LIKE '%uae%'
  );

UPDATE "Tour"
SET "imageUrl" = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=80'
WHERE "approvalStatus" = 'approved'
  AND ("imageUrl" IS NULL OR trim("imageUrl") = '');
