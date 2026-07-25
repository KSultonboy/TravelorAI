const DEFAULT_TOUR_IMAGE =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=80';

const TOUR_IMAGE_FALLBACKS = [
  {
    terms: ['dubai', 'dubay', 'uae', 'birlashgan arab'],
    imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1400&q=80',
  },
  {
    terms: ['samarkand', 'samarqand'],
    imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1400&q=80',
  },
  {
    terms: ['bukhara', 'buxoro'],
    imageUrl: 'https://images.unsplash.com/photo-1609412058473-978e48f6b2f8?auto=format&fit=crop&w=1400&q=80',
  },
];

function resolveTourImageUrl(tour) {
  const explicitImage = String(tour?.imageUrl || '').trim();
  if (explicitImage) return explicitImage;

  const haystack = [
    tour?.title,
    tour?.city,
    tour?.subtitle,
    tour?.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const match = TOUR_IMAGE_FALLBACKS.find((fallback) =>
    fallback.terms.some((term) => haystack.includes(term))
  );

  return match?.imageUrl || DEFAULT_TOUR_IMAGE;
}

module.exports = { resolveTourImageUrl };
