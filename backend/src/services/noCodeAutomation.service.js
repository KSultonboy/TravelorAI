const { prisma } = require('../config/database');
const { assignNextMember, OPEN_STAGES } = require('./crmAutomation.service');
const { sendAutomationEmail } = require('./email.service');

const TRIGGERS = ['lead_created', 'lead_unanswered', 'stage_changed', 'payment_overdue', 'document_signed'];
const ACTIONS = ['create_task', 'assign_manager', 'move_stage', 'add_tag', 'send_email'];
const CONDITION_FIELDS = ['stage', 'source', 'assignedMemberId', 'currency', 'amount', 'direction', 'status', 'customerName'];
const OPERATORS = ['equals', 'not_equals', 'contains', 'greater_or_equal', 'less_or_equal', 'is_empty', 'not_empty'];
const STAGES = ['new', 'contacted', 'quoted', 'won', 'completed', 'lost'];

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function renderTemplate(template, context) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const value = context[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

function conditionMatches(context, condition) {
  const field = CONDITION_FIELDS.includes(condition?.field) ? condition.field : null;
  const operator = OPERATORS.includes(condition?.operator) ? condition.operator : 'equals';
  if (!field) return false;
  const actual = context[field]; const expected = condition.value;
  if (operator === 'is_empty') return actual === null || actual === undefined || actual === '';
  if (operator === 'not_empty') return actual !== null && actual !== undefined && actual !== '';
  if (operator === 'contains') return String(actual || '').toLowerCase().includes(String(expected || '').toLowerCase());
  if (operator === 'greater_or_equal') return Number(actual) >= Number(expected);
  if (operator === 'less_or_equal') return Number(actual) <= Number(expected);
  if (operator === 'not_equals') return String(actual ?? '') !== String(expected ?? '');
  return String(actual ?? '') === String(expected ?? '');
}

function matchesConditions(context, conditions, mode = 'all') {
  const rows = Array.isArray(conditions) ? conditions.filter(Boolean) : [];
  if (!rows.length) return true;
  return mode === 'any' ? rows.some((row) => conditionMatches(context, row)) : rows.every((row) => conditionMatches(context, row));
}

function entityContext(entity) {
  if (entity.type === 'lead') return {
    id: entity.data.id, entityType: 'lead', customerName: entity.data.customerName,
    customerEmail: entity.data.customerEmail, stage: entity.data.pipelineStage, source: entity.data.source,
    assignedMemberId: entity.data.assignedMemberId, amount: entity.data.totalEstimate || 0,
    currency: entity.data.currency, status: entity.data.status, direction: '',
  };
  if (entity.type === 'payment') return {
    id: entity.data.id, entityType: 'payment', customerName: entity.data.counterparty || entity.data.booking?.customerName || '',
    customerEmail: entity.data.booking?.customerEmail || '', stage: entity.data.booking?.pipelineStage || '',
    source: entity.data.booking?.source || '', assignedMemberId: entity.data.booking?.assignedMemberId || entity.data.managerMemberId,
    amount: entity.data.amount,
    currency: entity.data.currency, status: entity.data.status, direction: entity.data.direction,
  };
  return {
    id: entity.data.id, entityType: 'document', customerName: entity.data.customerName || '',
    customerEmail: entity.data.booking?.customerEmail || '', stage: entity.data.booking?.pipelineStage || '',
    source: entity.data.booking?.source || '', assignedMemberId: entity.data.booking?.assignedMemberId,
    amount: entity.data.amount || 0, currency: entity.data.currency, status: entity.data.status, direction: '',
  };
}

function eventKey(rule, entity) {
  if (rule.triggerType === 'stage_changed') return `stage:${entity.data.id}:${entity.data.pipelineStage}`;
  if (rule.triggerType === 'payment_overdue') return `payment_overdue:${entity.data.id}`;
  if (rule.triggerType === 'document_signed') return `document_signed:${entity.data.id}`;
  if (rule.triggerType === 'lead_unanswered') return `lead_unanswered:${entity.data.id}`;
  return `lead_created:${entity.data.id}`;
}

async function resolveEntities(rule, { limit = 200, manual = false } = {}) {
  const config = cleanObject(rule.triggerConfig); const since = manual ? undefined : (rule.lastRunAt || rule.createdAt);
  if (rule.triggerType === 'lead_created') {
    return (await prisma.tourBooking.findMany({
      where: { agencyId: rule.agencyId, archived: false, ...(since ? { createdAt: { gt: since } } : {}) },
      orderBy: { createdAt: 'desc' }, take: manual ? 1 : limit,
    })).map((data) => ({ type: 'lead', data }));
  }
  if (rule.triggerType === 'lead_unanswered') {
    const minutes = Math.min(10080, Math.max(5, Number(config.minutes) || 30));
    return (await prisma.tourBooking.findMany({
      where: { agencyId: rule.agencyId, archived: false, pipelineStage: { in: OPEN_STAGES }, firstResponseAt: null, createdAt: { lte: new Date(Date.now() - minutes * 60000) } },
      orderBy: { createdAt: 'desc' }, take: manual ? 1 : limit,
    })).map((data) => ({ type: 'lead', data }));
  }
  if (rule.triggerType === 'stage_changed') {
    const stage = STAGES.includes(config.stage) ? config.stage : 'won';
    return (await prisma.tourBooking.findMany({
      where: { agencyId: rule.agencyId, archived: false, pipelineStage: stage, ...(since ? { updatedAt: { gt: since } } : {}) },
      orderBy: { updatedAt: 'desc' }, take: manual ? 1 : limit,
    })).map((data) => ({ type: 'lead', data }));
  }
  if (rule.triggerType === 'payment_overdue') {
    return (await prisma.financeTransaction.findMany({
      where: { agencyId: rule.agencyId, status: 'planned', dueAt: { lt: new Date() } },
      include: { booking: true }, orderBy: { dueAt: 'asc' }, take: manual ? 1 : limit,
    })).map((data) => ({ type: 'payment', data }));
  }
  return (await prisma.businessDocument.findMany({
    where: { agencyId: rule.agencyId, status: 'signed', ...(since ? { updatedAt: { gt: since } } : {}) },
    include: { booking: true }, orderBy: { updatedAt: 'desc' }, take: manual ? 1 : limit,
  })).map((data) => ({ type: 'document', data }));
}

async function executeAction(run, action, entity, context) {
  const config = cleanObject(action.config); const lead = entity.type === 'lead' ? entity.data : entity.data.booking;
  if (action.type === 'create_task') {
    if (!lead?.id) throw new Error('Vazifa uchun lid topilmadi');
    const title = renderTemplate(config.title || '{customerName} bilan bog‘lanish', context).trim().slice(0, 300);
    const dueMinutes = Math.min(43200, Math.max(0, Number(config.dueMinutes) || 0));
    const currentLead = await prisma.tourBooking.findUnique({ where: { id: lead.id }, select: { assignedMemberId: true } });
    const task = await prisma.crmTask.upsert({
      where: { agencyId_externalId: { agencyId: run.agencyId, externalId: `automation:${run.id}:${action.id}` } },
      create: { agencyId: run.agencyId, bookingId: lead.id, assignedMemberId: currentLead?.assignedMemberId || null, title, dueAt: new Date(Date.now() + dueMinutes * 60000), externalId: `automation:${run.id}:${action.id}` },
      update: {},
    });
    return { actionId: action.id, type: action.type, taskId: task.id };
  }
  if (action.type === 'assign_manager') {
    if (!lead?.id) throw new Error('Menejer biriktirish uchun lid topilmadi');
    const member = await assignNextMember(run.agencyId, prisma, true);
    if (!member) throw new Error('Faol menejer topilmadi');
    await prisma.$transaction([
      prisma.tourBooking.update({ where: { id: lead.id }, data: { assignedMemberId: member.id } }),
      prisma.leadActivity.create({ data: { agencyId: run.agencyId, bookingId: lead.id, type: 'assignment', text: `Avtomatizatsiya menejer biriktirdi: ${member.name}`, externalId: `automation:${run.id}:${action.id}` } }),
    ]);
    return { actionId: action.id, type: action.type, memberId: member.id, memberName: member.name };
  }
  if (action.type === 'move_stage') {
    if (!lead?.id) throw new Error('Bosqichni o‘zgartirish uchun lid topilmadi');
    const stage = STAGES.includes(config.stage) ? config.stage : null;
    if (!stage) throw new Error('Yangi bosqich noto‘g‘ri');
    const current = await prisma.tourBooking.findUnique({ where: { id: lead.id } });
    if (!current) throw new Error('Lid topilmadi');
    const now = new Date(); const data = { pipelineStage: stage };
    if (stage !== 'new' && !current.firstResponseAt) data.firstResponseAt = now;
    if (stage === 'won') { data.status = 'confirmed'; if (!current.confirmedAt) data.confirmedAt = now; }
    else if (stage === 'completed') { data.status = 'completed'; if (!current.confirmedAt) data.confirmedAt = now; data.completedAt = now; }
    else if (stage === 'lost') { data.status = 'rejected'; data.rejectedAt = now; }
    await prisma.$transaction([
      prisma.tourBooking.update({ where: { id: lead.id }, data }),
      prisma.leadActivity.upsert({ where: { agencyId_externalId: { agencyId: run.agencyId, externalId: `automation:${run.id}:${action.id}` } }, create: { agencyId: run.agencyId, bookingId: lead.id, type: 'stage', text: `Avtomatik bosqich: ${stage}`, externalId: `automation:${run.id}:${action.id}` }, update: {} }),
    ]);
    return { actionId: action.id, type: action.type, stage };
  }
  if (action.type === 'add_tag') {
    if (!lead?.id) throw new Error('Teg uchun lid topilmadi');
    const name = renderTemplate(config.name || 'Avtomatik', context).trim().slice(0, 50);
    const tag = await prisma.leadTag.upsert({
      where: { bookingId_name: { bookingId: lead.id, name } },
      create: { agencyId: run.agencyId, bookingId: lead.id, name }, update: {},
    });
    return { actionId: action.id, type: action.type, tagId: tag.id, name };
  }
  if (action.type === 'send_email') {
    const recipient = config.recipient === 'owner'
      ? (await prisma.tourAgency.findUnique({ where: { id: run.agencyId }, include: { ownerAccount: { select: { email: true } } } }))?.ownerAccount?.email
      : context.customerEmail;
    if (!recipient) throw new Error('Email qabul qiluvchi topilmadi');
    const delivery = await sendAutomationEmail({
      email: recipient, subject: renderTemplate(config.subject || 'TravelorAI xabarnomasi', context),
      body: renderTemplate(config.body || 'Hurmatli {customerName}, so‘rovingiz yangilandi.', context),
    });
    if (delivery.delivery === 'log' && process.env.NODE_ENV === 'production') throw new Error('Email provider xabarni qabul qilmadi');
    return { actionId: action.id, type: action.type, recipient, delivery: delivery.delivery };
  }
  throw new Error('Noma’lum avtomatizatsiya amali');
}

async function executeRun(run, rule, entity) {
  const previous = cleanObject(run.output); const completed = Array.isArray(previous.actions) ? previous.actions : [];
  await prisma.automationRun.update({ where: { id: run.id }, data: { status: 'running', attempt: { increment: 1 }, startedAt: new Date(), error: null, nextRetryAt: null } });
  try {
    for (const action of rule.actions) {
      if (completed.some((item) => item.actionId === action.id)) continue;
      completed.push(await executeAction(run, action, entity, entityContext(entity)));
      await prisma.automationRun.update({ where: { id: run.id }, data: { output: { actions: completed } } });
    }
    return prisma.automationRun.update({ where: { id: run.id }, data: { status: 'success', output: { actions: completed }, finishedAt: new Date(), nextRetryAt: null } });
  } catch (err) {
    const attempt = run.attempt + 1; const terminal = attempt >= rule.maxAttempts;
    await prisma.automationRun.update({ where: { id: run.id }, data: {
      status: 'failed', output: { actions: completed }, error: String(err.message || err).slice(0, 2000), finishedAt: new Date(),
      nextRetryAt: terminal ? null : new Date(Date.now() + Math.min(60, 2 ** attempt) * 60000),
    } });
    throw err;
  }
}

async function createAndExecute(rule, entity, customKey) {
  const context = entityContext(entity);
  if (!matchesConditions(context, rule.conditions, rule.conditionMode)) return null;
  let run;
  try {
    run = await prisma.automationRun.create({ data: {
      agencyId: rule.agencyId, ruleId: rule.id, eventKey: customKey || eventKey(rule, entity),
      triggerType: rule.triggerType, entityType: entity.type, entityId: entity.data.id, input: context,
    } });
  } catch (err) {
    if (err.code === 'P2002') return null;
    throw err;
  }
  try { return await executeRun(run, rule, entity); } catch { return prisma.automationRun.findUnique({ where: { id: run.id } }); }
}

async function runRule(rule, options = {}) {
  const entities = await resolveEntities(rule, options); const results = [];
  for (const entity of entities) {
    const result = await createAndExecute(rule, entity, options.manual ? `manual:${Date.now()}:${entity.data.id}` : null);
    if (result) results.push(result);
  }
  await prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
  return results;
}

async function loadEntity(run) {
  if (run.entityType === 'lead') { const data = await prisma.tourBooking.findFirst({ where: { id: run.entityId, agencyId: run.agencyId } }); return data && { type: 'lead', data }; }
  if (run.entityType === 'payment') { const data = await prisma.financeTransaction.findFirst({ where: { id: run.entityId, agencyId: run.agencyId } }); return data && { type: 'payment', data }; }
  const data = await prisma.businessDocument.findFirst({ where: { id: run.entityId, agencyId: run.agencyId }, include: { booking: true } });
  return data && { type: 'document', data };
}

async function retryRun(run) {
  const full = await prisma.automationRun.findUnique({ where: { id: run.id }, include: { rule: { include: { actions: { orderBy: { sortOrder: 'asc' } } } } } });
  if (!full || full.status !== 'failed' || full.attempt >= full.rule.maxAttempts) return null;
  const entity = await loadEntity(full); if (!entity) return null;
  try { return await executeRun(full, full.rule, entity); } catch { return prisma.automationRun.findUnique({ where: { id: full.id } }); }
}

async function runAutomationMonitor(options = {}) {
  const agencyId = options.agencyId || null;
  const due = await prisma.automationRun.findMany({ where: { status: 'failed', nextRetryAt: { lte: new Date() }, ...(agencyId ? { agencyId } : {}) }, take: 100 });
  for (const run of due) await retryRun(run);
  const rules = await prisma.automationRule.findMany({ where: { active: true, ...(agencyId ? { agencyId } : {}) }, include: { actions: { orderBy: { sortOrder: 'asc' } } }, take: 1000 });
  let executed = 0;
  for (const rule of rules) executed += (await runRule(rule)).length;
  return { rules: rules.length, executed, retried: due.length };
}

module.exports = {
  ACTIONS, CONDITION_FIELDS, OPERATORS, STAGES, TRIGGERS, conditionMatches, matchesConditions,
  renderTemplate, retryRun, runAutomationMonitor, runRule,
};
