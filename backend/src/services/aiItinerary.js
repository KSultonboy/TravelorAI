// TravelorAI — AI marshrut generatori uchun umumiy mantiq (provider-agnostik).
// Claude (Anthropic) va Gemini (Google) ikkalasi ham shu prompt/schema/mapper'dan foydalanadi.
// POI/destination ma'lumoti bo'lmagan (asosan outbound) shaharlar uchun noldan kun-marshrut.

const ALLOWED_TYPES = new Set(['transport', 'landmark', 'food', 'attraction', 'hotel']);
const ACTIVITY_ICONS = { transport: 'TR', landmark: 'LM', food: 'FD', attraction: 'AT', hotel: 'HT' };

// enum ISHLATILMAYDI (Gemini responseJsonSchema cheklovi) — type mapping bosqichida tekshiriladi.
const AI_ITINERARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    destinations: { type: 'array', items: { type: 'string' } },
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day: { type: 'integer' },
          city: { type: 'string' },
          hotel: { type: 'string' },
          hotelCost: { type: 'integer' },
          activities: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                time: { type: 'string' },
                type: { type: 'string' },
                name: { type: 'string' },
                note: { type: 'string' },
                cost: { type: 'integer' },
              },
              required: ['time', 'type', 'name', 'note', 'cost'],
            },
          },
        },
        required: ['day', 'city', 'hotel', 'hotelCost', 'activities'],
      },
    },
    highlights: { type: 'array', items: { type: 'string' } },
    tips: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'destinations', 'days', 'highlights', 'tips', 'warnings'],
};

function buildAiItineraryPrompt(input) {
  const city = String(input.city || input.departureCity || '').trim();
  const duration = Math.max(1, Number(input.duration || 1));
  const travelers = Math.max(1, Number(input.travelers || 1));
  const budget = Number(input.budget || 0);
  const interests = Array.isArray(input.interests) ? input.interests : [];

  return [
    'You are TravelorAI, an expert travel planner for travelers from Uzbekistan.',
    `Build a realistic, day-by-day itinerary for a trip to "${city}".`,
    '',
    'Trip parameters:',
    `- Destination: ${city}`,
    `- Departure city: ${input.departureCity || '-'}`,
    `- Duration: ${duration} days`,
    `- Travelers: ${travelers} (companions: ${input.companions || 'solo'})`,
    `- Budget (total, all travelers): ${budget > 0 ? budget + ' UZS' : 'flexible'}`,
    `- Travel style: ${input.style || 'mid'} (budget=economy, mid=comfort, luxury=premium)`,
    `- Interests: ${interests.length ? interests.join(', ') : 'general sightseeing'}`,
    `- Food preference: ${input.foodPreferences || 'none'} (respect halal if requested)`,
    `- Transport preference: ${input.transportType || 'cheap'}`,
    '',
    'Rules:',
    '- Write ALL text in Uzbek (latin script). No markdown.',
    '- Use REAL, well-known place names for the destination (actual landmarks, museums, districts, restaurants, hotels). Do not invent fake names.',
    '- Each day: 4-6 activities ordered by time (HH:MM). Include arrival/transfer on day 1 and departure on the last day.',
    '- activity.type must be one of: transport, landmark, food, attraction, hotel.',
    '- Provide cost for EACH activity and hotelCost per night as integer UZS for the WHOLE GROUP of ' + travelers + ' traveler(s). Use ~13000 UZS = 1 USD for conversions.',
    budget > 0
      ? '- Keep the estimated total cost within the budget when realistic; if the budget is too low for the destination, still produce a sensible plan and add a short warning.'
      : '- Estimate sensible market costs for the destination.',
    '- hotel: a real hotel/area name suitable for the style; hotelCost: per-night group cost (0 only if no overnight, e.g. last day).',
    '- highlights: 3-5 short trip highlights. tips: 4-6 practical tips (money, transport, culture, safety). warnings: only real concerns (visa, budget, season) or empty.',
    '- Return ONLY JSON matching the provided schema.',
  ].join('\n');
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function coerceActivity(raw) {
  const type = ALLOWED_TYPES.has(String(raw?.type || '').toLowerCase())
    ? String(raw.type).toLowerCase()
    : 'attraction';
  return {
    time: String(raw?.time || '').trim() || '09:00',
    type,
    name: String(raw?.name || '').trim(),
    note: String(raw?.note || '').trim(),
    cost: Math.max(0, Math.round(Number(raw?.cost || 0))),
    icon: ACTIVITY_ICONS[type] || 'AT',
  };
}

function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function mapAiItineraryToPlan(parsed, input, meta = {}) {
  const duration = Math.max(1, Number(input.duration || 1));
  const travelers = Math.max(1, Number(input.travelers || 1));
  const budget = Number(input.budget || 0);
  const style = input.style || 'mid';

  const rawDays = Array.isArray(parsed?.days) ? parsed.days : [];
  if (!rawDays.length) return null;

  let transport = 0;
  let accommodation = 0;
  let food = 0;
  let attractions = 0;

  const days = rawDays.map((rawDay, index) => {
    const activities = (Array.isArray(rawDay?.activities) ? rawDay.activities : [])
      .map((a) => coerceActivity(a))
      .filter((a) => a.name);

    activities.forEach((a) => {
      if (a.type === 'transport') transport += a.cost;
      else if (a.type === 'food') food += a.cost;
      else attractions += a.cost;
    });

    const hotelCost = Math.max(0, Math.round(Number(rawDay?.hotelCost || 0)));
    accommodation += hotelCost;
    const destination = String(rawDay?.city || input.city || '').trim();

    return {
      day: Number(rawDay?.day || index + 1),
      dayNumber: Number(rawDay?.day || index + 1),
      destination,
      city: destination,
      activities,
      hotel: String(rawDay?.hotel || '').trim(),
      hotelCost,
      accommodation: { name: String(rawDay?.hotel || '').trim(), cost: hotelCost, type: 'hotel' },
    };
  });

  const miscBudget = budget > 0 ? Math.round(budget * 0.05) : 0;
  const totalCost = transport + accommodation + food + attractions + miscBudget;
  const perPersonCost = Math.round(totalCost / travelers);

  const destinations =
    Array.isArray(parsed?.destinations) && parsed.destinations.length
      ? parsed.destinations.map((d) => String(d).trim()).filter(Boolean)
      : [String(input.city || '').trim()].filter(Boolean);

  const asList = (value, max) =>
    Array.from(new Set((Array.isArray(value) ? value : []).map((x) => String(x || '').trim()).filter(Boolean))).slice(
      0,
      max
    );

  return {
    id: genId(),
    title: String(parsed?.title || '').trim() || `${input.city} sayohati`,
    totalCost,
    perPersonCost,
    budgetUsed: budget > 0 ? Math.round((totalCost / budget) * 100) : 0,
    budgetRemaining: budget > 0 ? budget - totalCost : 0,
    style,
    travelers,
    duration,
    destinations,
    transportLegs: [],
    days,
    breakdown: { transport, accommodation, food, attractions, misc: miscBudget },
    tips: asList(parsed?.tips, 10),
    warnings: asList(parsed?.warnings, 8),
    highlights: asList(parsed?.highlights, 6),
    dataConfidence: 'ai_generated',
    sourceSummary: `AI (${meta.provider || 'ai'}) tomonidan yaratilgan marshrut`,
    alternatives: { transport: [] },
    verificationWarnings: [],
    aiProvider: meta.provider || 'ai',
    aiModel: meta.model || '',
  };
}

module.exports = { AI_ITINERARY_SCHEMA, buildAiItineraryPrompt, mapAiItineraryToPlan, tryParseJson };
