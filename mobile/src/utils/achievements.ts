import type { TripPlan } from './tripPlanner';

type AchievementMetric =
  | 'tripCount'
  | 'uniqueCities'
  | 'totalSpent'
  | 'budgetTrips'
  | 'maxDuration'
  | 'maxTravelers';

interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  hint: string;
  icon: string;
  accent: string;
  metric: AchievementMetric;
  target: number;
}

export interface AchievementStats {
  tripCount: number;
  uniqueCities: number;
  totalSpent: number;
  budgetTrips: number;
  maxDuration: number;
  maxTravelers: number;
}

export interface AchievementItem extends AchievementDefinition {
  current: number;
  unlocked: boolean;
  progress: number;
  progressText: string;
}

export interface AchievementsState {
  items: AchievementItem[];
  unlocked: AchievementItem[];
  locked: AchievementItem[];
  unlockedCount: number;
  totalCount: number;
  completionRate: number;
  nextAchievement: AchievementItem | null;
  stats: AchievementStats;
}

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first_trip',
    title: 'achievements.items.first_trip.title',
    description: 'achievements.items.first_trip.description',
    hint: 'achievements.items.first_trip.hint',
    icon: 'airplane-outline',
    accent: '#1A6B3C',
    metric: 'tripCount',
    target: 1,
  },
  {
    id: 'three_city_explorer',
    title: 'achievements.items.three_city_explorer.title',
    description: 'achievements.items.three_city_explorer.description',
    hint: 'achievements.items.three_city_explorer.hint',
    icon: 'location-outline',
    accent: '#2563EB',
    metric: 'uniqueCities',
    target: 3,
  },
  {
    id: 'five_city_legend',
    title: 'achievements.items.five_city_legend.title',
    description: 'achievements.items.five_city_legend.description',
    hint: 'achievements.items.five_city_legend.hint',
    icon: 'map-outline',
    accent: '#7C3AED',
    metric: 'uniqueCities',
    target: 5,
  },
  {
    id: 'budget_traveler',
    title: 'achievements.items.budget_traveler.title',
    description: 'achievements.items.budget_traveler.description',
    hint: 'achievements.items.budget_traveler.hint',
    icon: 'wallet-outline',
    accent: '#D97706',
    metric: 'budgetTrips',
    target: 1,
  },
  {
    id: 'group_explorer',
    title: 'achievements.items.group_explorer.title',
    description: 'achievements.items.group_explorer.description',
    hint: 'achievements.items.group_explorer.hint',
    icon: 'people-outline',
    accent: '#DB2777',
    metric: 'maxTravelers',
    target: 3,
  },
  {
    id: 'marathon_journey',
    title: 'achievements.items.marathon_journey.title',
    description: 'achievements.items.marathon_journey.description',
    hint: 'achievements.items.marathon_journey.hint',
    icon: 'time-outline',
    accent: '#0F766E',
    metric: 'maxDuration',
    target: 7,
  },
  {
    id: 'millionaire_traveler',
    title: 'achievements.items.millionaire_traveler.title',
    description: 'achievements.items.millionaire_traveler.description',
    hint: 'achievements.items.millionaire_traveler.hint',
    icon: 'cash-outline',
    accent: '#C8933A',
    metric: 'totalSpent',
    target: 1_000_000,
  },
  {
    id: 'trip_collector',
    title: 'achievements.items.trip_collector.title',
    description: 'achievements.items.trip_collector.description',
    hint: 'achievements.items.trip_collector.hint',
    icon: 'trophy-outline',
    accent: '#DC2626',
    metric: 'tripCount',
    target: 5,
  },
];

function formatCompactValue(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }

  return String(value);
}

function buildProgressText(metric: AchievementMetric, current: number, target: number) {
  if (metric === 'totalSpent') {
    return `${formatCompactValue(current)} / ${formatCompactValue(target)} so'm`;
  }

  return `${Math.min(current, target)} / ${target}`;
}

export function getAchievementStats(trips: TripPlan[]): AchievementStats {
  const uniqueCities = new Set<string>();
  let totalSpent = 0;
  let budgetTrips = 0;
  let maxDuration = 0;
  let maxTravelers = 0;

  trips.forEach((trip) => {
    totalSpent += trip.totalCost || 0;
    maxDuration = Math.max(maxDuration, trip.duration || 0);
    maxTravelers = Math.max(maxTravelers, trip.travelers || 0);

    if (trip.style === 'budget' || (trip.totalCost || 0) <= 800_000) {
      budgetTrips += 1;
    }

    (trip.destinations || []).forEach((destination) => uniqueCities.add(destination));
  });

  return {
    tripCount: trips.length,
    uniqueCities: uniqueCities.size,
    totalSpent,
    budgetTrips,
    maxDuration,
    maxTravelers,
  };
}

export function getAchievements(trips: TripPlan[]): AchievementsState {
  const stats = getAchievementStats(trips);

  const items = ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const current = stats[definition.metric];
    const progress = Math.min(current / definition.target, 1);

    return {
      ...definition,
      current,
      unlocked: current >= definition.target,
      progress,
      progressText: buildProgressText(definition.metric, current, definition.target),
    };
  });

  const unlocked = items.filter((item) => item.unlocked);
  const locked = items
    .filter((item) => !item.unlocked)
    .sort((a, b) => b.progress - a.progress || a.target - b.target);

  return {
    items,
    unlocked,
    locked,
    unlockedCount: unlocked.length,
    totalCount: items.length,
    completionRate: items.length > 0 ? unlocked.length / items.length : 0,
    nextAchievement: locked[0] || null,
    stats,
  };
}
