export interface PlanInput {
  budget: number;
  duration: number;
  travelers: number;
  style: 'budget' | 'mid' | 'luxury';
  interests: string[];
}

export interface Activity {
  time: string;
  type: string;
  name: string;
  cost: number;
  icon: string;
  lat?: number;
  lng?: number;
  source?: string;
  confidenceScore?: number;
  bookingUrl?: string;
  durationMinutes?: number;
  distanceKm?: number;
  note?: string;
}

export interface DayPlan {
  day: number;
  destination: string;
  activities: Activity[];
  hotel: string;
  hotelCost: number;
}

export type TripPlanStatus = 'draft' | 'final' | 'failed' | 'archived';
export type TripPlanSource = 'local' | 'backend';
export type TripSyncStatus = 'pending' | 'synced' | 'failed';

export interface TripPlan {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  coverImage?: string;
  notes?: string;
  totalCost: number;
  duration: number;
  travelers: number;
  style: string;
  destinations: string[];
  transportLegs?: TransportLeg[];
  breakdown: {
    transport: number;
    accommodation: number;
    food: number;
    attractions: number;
    misc: number;
  };
  days: DayPlan[];
  warnings: string[];
  highlights: string[];
  tips: string[];
  dataConfidence?: {
    score: number;
    level: 'low' | 'medium' | 'high';
    label: string;
  };
  sourceSummary?: {
    destinationCount?: number;
    poiCount?: number;
    transportRouteCount?: number;
    hasEstimatedTransport?: boolean;
    generatedFrom?: string[];
  };
  alternatives?: {
    transport?: TransportLeg[];
  };
  verificationWarnings?: string[];
  status?: TripPlanStatus;
  source?: TripPlanSource;
  syncStatus?: TripSyncStatus;
  updatedAt?: string;
  progress?: {
    visitedStopIds: string[];
    notes: Record<string, string>;
    updatedAt: string;
  };
  createdAt: string;
}

export interface TransportLeg {
  id: string;
  fromCity: string;
  toCity: string;
  mode: string;
  providerName?: string;
  priceMin: number;
  priceMax: number;
  estimatedCost: number;
  durationMinutes?: number;
  duration?: string;
  distanceKm?: number | null;
  scheduleNote?: string;
  bookingUrl?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  confidenceScore: number;
  whyChosen?: string;
  isEstimated?: boolean;
  alternatives?: TransportLeg[];
}

export function generateTripPlan(input: PlanInput): TripPlan {
  void input;
  throw new Error('Offline static planning is disabled. Use backend planner API.');
}
