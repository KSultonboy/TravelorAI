const axios = require('axios');
const { logger } = require('../config/logger');
const { AI_ITINERARY_SCHEMA, buildAiItineraryPrompt, mapAiItineraryToPlan } = require('./aiItinerary');

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_API_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_TIMEOUT_MS = 9000;
const ALLOWED_ACTIVITY_TYPES = new Set(['transport', 'landmark', 'food', 'attraction']);

const REFINEMENT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    highlights: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
    tips: { type: 'array', items: { type: 'string' } },
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          dayNumber: { type: 'integer' },
          city: { type: 'string' },
          transportNote: { type: 'string' },
          accommodationName: { type: 'string' },
          activities: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                time: { type: 'string' },
                type: { type: 'string' },
                name: { type: 'string' },
                duration: { type: 'string' },
                optional: { type: 'boolean' },
              },
              required: ['time', 'type', 'name'],
            },
          },
        },
        required: ['dayNumber', 'city', 'activities'],
      },
    },
  },
  required: ['title', 'highlights', 'warnings', 'tips', 'days'],
};

function readConfig() {
  const enabled = String(process.env.GEMINI_PLANNER_ENABLED || 'true').toLowerCase() !== 'false';
  return {
    enabled,
    apiKey: String(process.env.GEMINI_API_KEY || '').trim(),
    model: String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    apiBaseUrl:
      String(process.env.GEMINI_API_BASE_URL || DEFAULT_API_BASE_URL).trim() || DEFAULT_API_BASE_URL,
    timeoutMs: Math.max(1500, Number(process.env.GEMINI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)),
  };
}

function compactBasePlan(basePlan) {
  return {
    title: basePlan.title,
    style: basePlan.style,
    duration: basePlan.duration,
    travelers: basePlan.travelers,
    destinations: Array.isArray(basePlan.destinations) ? basePlan.destinations : [],
    breakdown: basePlan.breakdown,
    highlights: Array.isArray(basePlan.highlights) ? basePlan.highlights : [],
    warnings: Array.isArray(basePlan.warnings) ? basePlan.warnings : [],
    tips: Array.isArray(basePlan.tips) ? basePlan.tips : [],
    days: Array.isArray(basePlan.days)
      ? basePlan.days.map((day) => ({
          dayNumber: Number(day.dayNumber || day.day || 1),
          city: String(day.city || day.destination || '').trim(),
          transportNote: String(day.transportNote || '').trim(),
          accommodationName: String(day.accommodation?.name || day.hotel || '').trim(),
          activities: Array.isArray(day.activities)
            ? day.activities.map((activity) => ({
                time: String(activity.time || '').trim(),
                type: String(activity.type || '').trim().toLowerCase(),
                name: String(activity.name || '').trim(),
                duration: String(activity.duration || '').trim(),
              }))
            : [],
        }))
      : [],
  };
}

function compactPoiContext(poiContext) {
  const list = Array.isArray(poiContext) ? poiContext : [];

  return list
    .map((item) => ({
      name: asText(item?.name),
      city: asText(item?.city),
      type: asText(item?.type),
      subtype: asText(item?.subtype),
      info: asText(item?.info || item?.description),
      lat: Number.isFinite(Number(item?.lat)) ? Number(item.lat) : null,
      lng: Number.isFinite(Number(item?.lng)) ? Number(item.lng) : null,
      price: Number.isFinite(Number(item?.price)) ? Number(item.price) : null,
      rating: Number.isFinite(Number(item?.rating)) ? Number(item.rating) : null,
    }))
    .filter((item) => item.name)
    .slice(0, 1200);
}

function buildPrompt({ request, basePlan }) {
  const poiContext = compactPoiContext(request.poiContext);
  const payload = {
    request: {
      city: request.city || request.departureCity || '',
      departureCity: request.departureCity || '',
      budget: Number(request.budget || 0),
      duration: Number(request.duration || 1),
      travelers: Number(request.travelers || 1),
      style: request.style || 'mid',
      interests: Array.isArray(request.interests) ? request.interests : [],
      companions: request.companions || 'solo',
      foodPreferences: request.foodPreferences || 'none',
      transportType: request.transportType || 'cheap',
      flexibility: request.flexibility || 'fixed',
      analysisContext: request.analysisContext || null,
      recommendedPoiNames: Array.isArray(request.recommendedPoiNames)
        ? request.recommendedPoiNames.slice(0, 12)
        : [],
      poiContextTotal: Array.isArray(request.poiContext) ? request.poiContext.length : 0,
      poiContext,
    },
    basePlan: compactBasePlan(basePlan),
  };

  return [
    'You are TravelorAI itinerary refiner for global trips.',
    'Rewrite itinerary text to be clearer and more user-friendly in Uzbek latin.',
    'Very important constraints:',
    '- Keep same number of days as basePlan.days.',
    '- Keep same number of activities per day as basePlan.',
    '- Prefer place names from request.poiContext and request.recommendedPoiNames.',
    '- Do not invent new places that are not in basePlan/request context.',
    '- Do not add markdown.',
    '- Keep activity types in this set only: transport, landmark, food, attraction.',
    '- Return ONLY valid JSON according to provided schema.',
    '',
    'INPUT:',
    JSON.stringify(payload),
  ].join('\n');
}

function extractResponseText(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const first = candidates[0];
  const parts = Array.isArray(first?.content?.parts) ? first.content.parts : [];
  const text = parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('')
    .trim();
  return text || null;
}

function tryParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const maybe = text.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(maybe);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeActivityType(value, fallback) {
  const type = String(value || '').trim().toLowerCase();
  return ALLOWED_ACTIVITY_TYPES.has(type) ? type : fallback;
}

function asText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeList(value, fallback, maxItems) {
  const raw = Array.isArray(value) ? value : [];
  const normalized = Array.from(
    new Set(raw.map((item) => asText(item)).filter(Boolean))
  ).slice(0, maxItems);
  if (normalized.length > 0) return normalized;
  return Array.isArray(fallback) ? fallback.slice(0, maxItems) : [];
}

function mergeWithBasePlan(basePlan, refined) {
  if (!refined || typeof refined !== 'object') return null;

  const refinedDays = Array.isArray(refined.days) ? refined.days : [];
  const refinedByDay = new Map();
  refinedDays.forEach((item, index) => {
    const key = Number(item?.dayNumber || index + 1);
    refinedByDay.set(key, item);
  });

  const mergedDays = (basePlan.days || []).map((baseDay, index) => {
    const dayNumber = Number(baseDay.dayNumber || baseDay.day || index + 1);
    const refinedDay = refinedByDay.get(dayNumber) || refinedDays[index] || {};
    const refinedActivities = Array.isArray(refinedDay.activities) ? refinedDay.activities : [];
    const baseActivities = Array.isArray(baseDay.activities) ? baseDay.activities : [];

    const activities = baseActivities.map((baseActivity, activityIndex) => {
      const refinedActivity = refinedActivities[activityIndex] || {};
      return {
        ...baseActivity,
        time: asText(refinedActivity.time, baseActivity.time || ''),
        type: normalizeActivityType(refinedActivity.type, baseActivity.type || 'attraction'),
        name: asText(refinedActivity.name, baseActivity.name || ''),
        duration: asText(refinedActivity.duration, baseActivity.duration || ''),
        optional:
          typeof refinedActivity.optional === 'boolean'
            ? refinedActivity.optional
            : Boolean(baseActivity.optional),
      };
    });

    return {
      ...baseDay,
      dayNumber,
      city: asText(refinedDay.city, baseDay.city || baseDay.destination || ''),
      destination: asText(refinedDay.city, baseDay.destination || baseDay.city || ''),
      transportNote: asText(refinedDay.transportNote, baseDay.transportNote || ''),
      accommodation: {
        ...(baseDay.accommodation || { name: '', cost: 0 }),
        name: asText(refinedDay.accommodationName, baseDay.accommodation?.name || ''),
      },
      activities,
    };
  });

  return {
    ...basePlan,
    title: asText(refined.title, basePlan.title),
    highlights: normalizeList(refined.highlights, basePlan.highlights, 6),
    warnings: normalizeList(refined.warnings, basePlan.warnings, 8),
    tips: normalizeList(refined.tips, basePlan.tips, 10),
    days: mergedDays,
    aiProvider: 'gemini',
    aiModel: readConfig().model,
  };
}

async function refineTripPlanWithGemini({ basePlan, request }) {
  const config = readConfig();
  if (!config.enabled || !config.apiKey || !basePlan) return null;

  const url = `${config.apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${encodeURIComponent(
    config.model
  )}:generateContent`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: buildPrompt({ request, basePlan }) }],
      },
    ],
    generationConfig: {
      temperature: 0.25,
      topP: 0.9,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseJsonSchema: REFINEMENT_RESPONSE_SCHEMA,
    },
  };

  try {
    const response = await axios.post(url, body, {
      timeout: config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
    });

    const text = extractResponseText(response.data);
    const json = tryParseJson(text);
    const merged = mergeWithBasePlan(basePlan, json);

    if (!merged) {
      logger.warn('Gemini planner returned unparsable payload, fallback plan kept');
      return null;
    }

    return merged;
  } catch (err) {
    const status = err?.response?.status;
    const message = err?.response?.data?.error?.message || err?.message || 'unknown Gemini error';
    logger.warn('Gemini planner refinement failed, fallback plan kept', { status, message });
    return null;
  }
}

// To'liq marshrutni NOLDAN yaratadi (POI/destination ma'lumoti bo'lmaganda).
// refineTripPlanWithGemini faqat matnni yaxshilaydi; bu esa kun-marshrutni o'zi quradi.
async function generateTripPlanWithGemini(input) {
  const config = readConfig();
  if (!config.enabled || !config.apiKey) return null;

  const url = `${config.apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${encodeURIComponent(
    config.model
  )}:generateContent`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: buildAiItineraryPrompt(input) }] }],
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseJsonSchema: AI_ITINERARY_SCHEMA,
      // gemini-2.5-flash "thinking"ni o'chiramiz — generatsiya ancha tezlashadi.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  try {
    const response = await axios.post(url, body, {
      timeout: Math.max(config.timeoutMs, 50000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
    });

    const text = extractResponseText(response.data);
    const parsed = tryParseJson(text);
    const plan = mapAiItineraryToPlan(parsed, input, { provider: 'gemini', model: config.model });

    if (!plan) {
      logger.warn('Gemini planner returned unusable generation payload');
      return null;
    }
    return plan;
  } catch (err) {
    const status = err?.response?.status;
    const message = err?.response?.data?.error?.message || err?.message || 'unknown Gemini error';
    logger.warn('Gemini planner generation failed', { status, message });
    return null;
  }
}

module.exports = { refineTripPlanWithGemini, generateTripPlanWithGemini };
