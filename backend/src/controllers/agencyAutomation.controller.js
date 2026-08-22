const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { ACTIONS, CONDITION_FIELDS, OPERATORS, STAGES, TRIGGERS, retryRun, runRule } = require('../services/noCodeAutomation.service');

function agencyOr404(req, res) {
  if (!req.agency?.id) { error(res, 'Agentlik topilmadi', 404); return null; }
  return req.agency;
}
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function text(value, max = 300) { return String(value || '').trim().slice(0, max); }
function normalizeConfig(type, value) {
  const config = object(value);
  if (type === 'create_task') return { title: text(config.title || '{customerName} bilan bog‘lanish'), dueMinutes: Math.min(43200, Math.max(0, Number(config.dueMinutes) || 0)) };
  if (type === 'assign_manager') return { mode: 'round_robin' };
  if (type === 'move_stage') return { stage: STAGES.includes(config.stage) ? config.stage : 'contacted' };
  if (type === 'add_tag') return { name: text(config.name || 'Avtomatik', 50) };
  return { recipient: config.recipient === 'owner' ? 'owner' : 'customer', subject: text(config.subject || 'TravelorAI xabarnomasi', 180), body: text(config.body || 'Hurmatli {customerName}, so‘rovingiz yangilandi.', 5000) };
}
function normalizePayload(body) {
  const triggerType = TRIGGERS.includes(body?.triggerType) ? body.triggerType : null;
  if (!triggerType) throw new Error('Trigger turini tanlang');
  const actions = (Array.isArray(body?.actions) ? body.actions : []).slice(0, 10).map((item) => {
    const type = ACTIONS.includes(item?.type) ? item.type : null;
    return type ? { type, config: normalizeConfig(type, item.config) } : null;
  }).filter(Boolean);
  if (!actions.length) throw new Error('Kamida bitta amal qo‘shing');
  const conditions = (Array.isArray(body?.conditions) ? body.conditions : []).slice(0, 10).map((item) => ({
    field: CONDITION_FIELDS.includes(item?.field) ? item.field : null,
    operator: OPERATORS.includes(item?.operator) ? item.operator : 'equals', value: text(item?.value, 300),
  })).filter((item) => item.field);
  const triggerConfig = object(body?.triggerConfig);
  return {
    name: text(body?.name) || 'Yangi avtomatizatsiya', active: body?.active !== false, triggerType,
    triggerConfig: { minutes: Math.min(10080, Math.max(5, Number(triggerConfig.minutes) || 30)), stage: STAGES.includes(triggerConfig.stage) ? triggerConfig.stage : 'won' },
    conditionMode: body?.conditionMode === 'any' ? 'any' : 'all', conditions,
    maxAttempts: Math.min(5, Math.max(1, Number(body?.maxAttempts) || 3)), actions,
  };
}

async function list(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const [rules, runs] = await Promise.all([
      prisma.automationRule.findMany({ where: { agencyId: agency.id }, include: { actions: { orderBy: { sortOrder: 'asc' } }, _count: { select: { runs: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.automationRun.findMany({ where: { agencyId: agency.id }, include: { rule: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    return success(res, { rules, runs, metadata: { triggers: TRIGGERS, actions: ACTIONS, conditionFields: CONDITION_FIELDS, operators: OPERATORS, stages: STAGES } });
  } catch (err) { return error(res, err.message, 500); }
}
async function create(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return; const payload = normalizePayload(req.body);
    const rule = await prisma.automationRule.create({ data: {
      agencyId: agency.id, name: payload.name, active: payload.active, triggerType: payload.triggerType, triggerConfig: payload.triggerConfig,
      conditionMode: payload.conditionMode, conditions: payload.conditions, maxAttempts: payload.maxAttempts, createdByAccountId: req.agencyAccount.id,
      actions: { create: payload.actions.map((action, index) => ({ ...action, sortOrder: index })) },
    }, include: { actions: { orderBy: { sortOrder: 'asc' } } } });
    return success(res, { rule }, 201);
  } catch (err) { return error(res, err.message, 400); }
}
async function update(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const existing = await prisma.automationRule.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Avtomatizatsiya topilmadi', 404); const payload = normalizePayload(req.body);
    const rule = await prisma.$transaction(async (tx) => {
      await tx.automationAction.deleteMany({ where: { ruleId: existing.id } });
      return tx.automationRule.update({ where: { id: existing.id }, data: {
        name: payload.name, active: payload.active, triggerType: payload.triggerType, triggerConfig: payload.triggerConfig,
        conditionMode: payload.conditionMode, conditions: payload.conditions, maxAttempts: payload.maxAttempts,
        actions: { create: payload.actions.map((action, index) => ({ ...action, sortOrder: index })) },
      }, include: { actions: { orderBy: { sortOrder: 'asc' } } } });
    });
    return success(res, { rule });
  } catch (err) { return error(res, err.message, 400); }
}
async function remove(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const existing = await prisma.automationRule.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Avtomatizatsiya topilmadi', 404);
    await prisma.automationRule.delete({ where: { id: existing.id } }); return success(res, { id: existing.id, deleted: true });
  } catch (err) { return error(res, err.message, 400); }
}
async function runNow(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const rule = await prisma.automationRule.findFirst({ where: { id: req.params.id, agencyId: agency.id }, include: { actions: { orderBy: { sortOrder: 'asc' } } } });
    if (!rule) return error(res, 'Avtomatizatsiya topilmadi', 404);
    const runs = await runRule(rule, { manual: true });
    if (!runs.length) return error(res, 'Trigger va shartlarga mos ma’lumot topilmadi', 404);
    return success(res, { runs });
  } catch (err) { return error(res, err.message, 400); }
}
async function retry(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const run = await prisma.automationRun.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!run) return error(res, 'Run topilmadi', 404); const result = await retryRun(run);
    if (!result) return error(res, 'Bu run qayta ishga tushirilmaydi', 400);
    return success(res, { run: result });
  } catch (err) { return error(res, err.message, 400); }
}
module.exports = { create, list, remove, retry, runNow, update };
