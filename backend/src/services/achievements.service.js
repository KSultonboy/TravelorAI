const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'first_trip',
    title: 'Birinchi Trip',
    description: 'Birinchi saqlangan sayohat rejangizni oldingiz.',
    hint: '1 ta trip saqlang',
    icon: 'airplane-outline',
    accent: '#1A6B3C',
    metric: 'tripCount',
    target: 1,
  },
  {
    id: 'three_city_explorer',
    title: '3 Shahar Sayyohi',
    description: 'Uchta turli shaharga sayohat qilgan sayyoh.',
    hint: '3 ta turli shaharni ko‘ring',
    icon: 'location-outline',
    accent: '#2563EB',
    metric: 'uniqueCities',
    target: 3,
  },
  {
    id: 'five_city_legend',
    title: '5 Shahar Ustasi',
    description: 'Besh va undan ko‘p manzilli tajribali sayohatchi.',
    hint: '5 ta turli shaharni ko‘ring',
    icon: 'map-outline',
    accent: '#7C3AED',
    metric: 'uniqueCities',
    target: 5,
  },
  {
    id: 'budget_traveler',
    title: 'Tejamkor Sayohat',
    description: 'Kamida bitta budget uslubidagi safar tuzildi.',
    hint: '1 ta budget trip yarating',
    icon: 'wallet-outline',
    accent: '#D97706',
    metric: 'budgetTrips',
    target: 1,
  },
  {
    id: 'group_explorer',
    title: 'Jamoaviy Marshrut',
    description: 'Do‘stlar bilan katta guruh safarini rejaladingiz.',
    hint: '3 yoki undan ko‘p sayohatchi bilan trip qiling',
    icon: 'people-outline',
    accent: '#DB2777',
    metric: 'maxTravelers',
    target: 3,
  },
  {
    id: 'marathon_journey',
    title: 'Uzoq Sarguzasht',
    description: 'Uzun muddatli safarga tayyor bo‘lgan sayyoh.',
    hint: '7 kunlik trip yarating',
    icon: 'time-outline',
    accent: '#0F766E',
    metric: 'maxDuration',
    target: 7,
  },
  {
    id: 'millionaire_traveler',
    title: 'Millioner Sayohatchi',
    description: 'Jami xarajat 1 million so‘mdan oshdi.',
    hint: 'Jami 1 000 000 so‘mga yeting',
    icon: 'cash-outline',
    accent: '#C8933A',
    metric: 'totalSpent',
    target: 1_000_000,
  },
  {
    id: 'trip_collector',
    title: 'Triplar Kollektori',
    description: 'Saqlangan triplar kolleksiyasi kengaymoqda.',
    hint: '5 ta trip to‘plang',
    icon: 'trophy-outline',
    accent: '#DC2626',
    metric: 'tripCount',
    target: 5,
  },
];

function formatCompactValue(value) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(value);
}

function buildProgressText(metric, current, target) {
  if (metric === 'totalSpent') {
    return `${formatCompactValue(current)} / ${formatCompactValue(target)} so'm`;
  }
  return `${Math.min(current, target)} / ${target}`;
}

function normalizeDestinationName(value) {
  if (!value || typeof value !== 'string') return null;
  return value.trim().toLowerCase();
}

function extractDestinationsFromTrip(trip) {
  const plan = trip.planData && typeof trip.planData === 'object' ? trip.planData : {};
  const result = new Set();

  if (Array.isArray(plan.destinations)) {
    plan.destinations.forEach((dest) => {
      const normalized = normalizeDestinationName(dest);
      if (normalized) result.add(normalized);
    });
  }

  if (Array.isArray(plan.days)) {
    plan.days.forEach((day) => {
      const candidates = [day.destination, day.city];
      candidates.forEach((candidate) => {
        const normalized = normalizeDestinationName(candidate);
        if (normalized) result.add(normalized);
      });
    });
  }

  return Array.from(result);
}

function getAchievementStats(trips) {
  const uniqueCities = new Set();
  let totalSpent = 0;
  let budgetTrips = 0;
  let maxDuration = 0;
  let maxTravelers = 0;

  trips.forEach((trip) => {
    const totalCost = Number(trip.totalCost || trip.planData?.totalCost || 0);
    const duration = Number(trip.duration || trip.planData?.duration || 0);
    const travelers = Number(trip.travelers || trip.planData?.travelers || 1);
    const style = String(trip.style || trip.planData?.style || '').toLowerCase();

    totalSpent += totalCost;
    maxDuration = Math.max(maxDuration, duration);
    maxTravelers = Math.max(maxTravelers, travelers);

    if (style === 'budget' || totalCost <= 800_000) {
      budgetTrips += 1;
    }

    extractDestinationsFromTrip(trip).forEach((city) => uniqueCities.add(city));
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

function getAchievementsFromTrips(trips) {
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

module.exports = {
  getAchievementsFromTrips,
};
