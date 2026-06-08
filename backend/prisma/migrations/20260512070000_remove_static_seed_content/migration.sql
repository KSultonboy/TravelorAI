DELETE FROM "Poi"
WHERE "id" IN (
  'poi_landing_registon',
  'poi_landing_kalon',
  'poi_landing_ichan_qala',
  'poi_landing_chorsu'
)
OR "source" IN ('manual_curated', 'fallback', 'google_places', 'mapbox', '2gis');

DELETE FROM "TravelerStory"
WHERE "id" IN (
  'story_xiva_verified_route',
  'story_samarqand_family_trip',
  'story_bukhara_local_tips'
)
OR "slug" IN (
  'xiva-verified-route',
  'samarqand-family-trip',
  'bukhara-local-tips'
);

DELETE FROM "TourAgency"
WHERE "id" IN (
  'agency_silk_road_expeditions',
  'agency_bukhara_local_guides',
  'agency_khiva_heritage_tours',
  'agency_tashkent_city_walks'
)
OR "slug" IN (
  'silk-road-expeditions',
  'bukhara-local-guides',
  'khiva-heritage-tours',
  'tashkent-city-walks'
);
