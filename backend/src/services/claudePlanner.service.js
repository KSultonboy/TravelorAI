const { logger } = require('../config/logger');
const { AI_ITINERARY_SCHEMA, buildAiItineraryPrompt, mapAiItineraryToPlan, tryParseJson } = require('./aiItinerary');

// TravelorAI — Anthropic Claude orqali to'liq AI marshrut generatori.
// ANTHROPIC_API_KEY bo'lmasa null qaytaradi (xato bermaydi).

const DEFAULT_MODEL = 'claude-opus-4-8';

function readConfig() {
  return {
    apiKey: String(process.env.ANTHROPIC_API_KEY || '').trim(),
    model: String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    enabled: String(process.env.CLAUDE_PLANNER_ENABLED || 'true').toLowerCase() !== 'false',
    timeoutMs: Math.max(8000, Number(process.env.ANTHROPIC_TIMEOUT_MS || 45000)),
  };
}

let client = null;
function getClient(config) {
  if (!config.apiKey) return null;
  if (!client) {
    let Anthropic;
    try {
      Anthropic = require('@anthropic-ai/sdk');
    } catch {
      logger.warn('Claude planner: @anthropic-ai/sdk not installed');
      return null;
    }
    client = new Anthropic({ apiKey: config.apiKey, timeout: config.timeoutMs, maxRetries: 1 });
  }
  return client;
}

function extractText(message) {
  const blocks = Array.isArray(message?.content) ? message.content : [];
  return blocks
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim();
}

async function generateTripPlanWithClaude(input) {
  const config = readConfig();
  if (!config.enabled) return null;
  const anthropic = getClient(config);
  if (!anthropic) return null;

  try {
    const message = await anthropic.messages.create({
      model: config.model,
      max_tokens: 16000,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: AI_ITINERARY_SCHEMA } },
      messages: [{ role: 'user', content: buildAiItineraryPrompt(input) }],
    });

    const parsed = tryParseJson(extractText(message));
    const plan = mapAiItineraryToPlan(parsed, input, { provider: 'anthropic', model: config.model });
    if (!plan) {
      logger.warn('Claude planner returned unusable payload');
      return null;
    }
    return plan;
  } catch (err) {
    logger.warn('Claude planner generation failed', { status: err?.status, message: err?.message });
    return null;
  }
}

module.exports = { generateTripPlanWithClaude };
