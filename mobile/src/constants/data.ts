export interface Landmark {
  name: string;
  entryFee: number;
  duration: number;
}

export interface Hotel {
  name: string;
  pricePerNight: number;
  stars: number;
}

export interface Destination {
  id: string;
  slug: string;
  name: string;
  region: string;
  description: string;
  image: string;
  rating: number;
  categories: string[];
  tags: string[];
  budgetDaily: number;
  midDaily: number;
  luxuryDaily: number;
  trainPrice: number;
  busPrice: number;
  flightPrice: number;
  minDays: number;
  maxDays: number;
  bestSeasons: string[];
  landmarks: Landmark[];
  hotels: Hotel[];
}

// Static destination list intentionally removed.
// Source of truth: backend /destinations endpoint.
export const DESTINATIONS: Destination[] = [];

export const TRAVEL_TIPS: { id: string; icon: string; title: string; text: string }[] = [];
