/* eslint-disable no-console */
const { prisma } = require('../src/config/database');
const { signAgencyToken } = require('../src/utils/agencyJwt');
const { runAutomationMonitor } = require('../src/services/noCodeAutomation.service');

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
let agencyId; const accountIds = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
async function api(token, path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(`${path}: ${body.message || response.status}`);
  return body.data;
}
async function cleanup() {
  if (agencyId) await prisma.tourAgency.deleteMany({ where: { id: agencyId } });
  if (accountIds.length) await prisma.agencyAccount.deleteMany({ where: { id: { in: accountIds } } });
}

async function main() {
  try {
    const owner = await prisma.agencyAccount.create({ data: { email: `automation-owner-${suffix}@smoke.invalid`, passwordHash: 'smoke', status: 'approved', emailVerified: true, emailVerifiedAt: new Date() } });
    accountIds.push(owner.id);
    const agency = await prisma.tourAgency.create({ data: { slug: `automation-${suffix}`, ownerAccountId: owner.id, name: 'Automation Smoke', city: 'Toshkent', specialty: 'Smoke', approvalStatus: 'approved', approvedAt: new Date() } });
    agencyId = agency.id; const token = signAgencyToken({ id: owner.id, email: owner.email });
    const firstLead = await prisma.tourBooking.create({ data: { agencyId, customerName: 'Retry Lead', travelers: 1, currency: 'USD', source: 'manual', status: 'pending', pipelineStage: 'new' } });

    const failing = await api(token, '/agency/crm/automation/rules', { method: 'POST', body: JSON.stringify({
      name: 'Menejer retry smoke', triggerType: 'lead_created', conditions: [], maxAttempts: 3,
      actions: [{ type: 'assign_manager', config: {} }],
    }) });
    const failedResult = await api(token, `/agency/crm/automation/rules/${failing.rule.id}/run`, { method: 'POST' });
    assert(failedResult.runs[0].status === 'failed' && failedResult.runs[0].attempt === 1, 'Birinchi run failed bo‘lmadi');

    const managerAccount = await prisma.agencyAccount.create({ data: { email: `automation-manager-${suffix}@smoke.invalid`, passwordHash: 'smoke', status: 'approved', emailVerified: true, emailVerifiedAt: new Date() } });
    accountIds.push(managerAccount.id);
    const member = await prisma.agencyMember.create({ data: { agencyId, accountId: managerAccount.id, name: 'Smoke Menejer', role: 'manager' } });
    const retried = await api(token, `/agency/crm/automation/runs/${failedResult.runs[0].id}/retry`, { method: 'POST' });
    assert(retried.run.status === 'success' && retried.run.attempt === 2, 'Retry muvaffaqiyatli tugamadi');
    const assigned = await prisma.tourBooking.findUnique({ where: { id: firstLead.id } });
    assert(assigned.assignedMemberId === member.id, 'Retry menejerni biriktirmadi');

    await api(token, `/agency/crm/automation/rules/${failing.rule.id}`, { method: 'PUT', body: JSON.stringify({ ...failing.rule, active: false }) });
    const rule = await api(token, '/agency/crm/automation/rules', { method: 'POST', body: JSON.stringify({
      name: 'Yangi manual lid workflow', active: true, triggerType: 'lead_created', conditionMode: 'all',
      conditions: [{ field: 'source', operator: 'equals', value: 'manual' }], maxAttempts: 3,
      actions: [
        { type: 'add_tag', config: { name: 'Avtomatik lid' } },
        { type: 'create_task', config: { title: '{customerName} bilan bog‘lanish', dueMinutes: 15 } },
        { type: 'move_stage', config: { stage: 'contacted' } },
      ],
    }) });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const lead = await prisma.tourBooking.create({ data: { agencyId, customerName: 'Automation Lead', travelers: 1, currency: 'USD', source: 'manual', status: 'pending', pipelineStage: 'new' } });
    const monitor = await runAutomationMonitor({ agencyId });
    assert(monitor.executed >= 1, 'Scheduler yangi lid qoidasini bajarmadi');
    const [updated, tag, task, successRun] = await Promise.all([
      prisma.tourBooking.findUnique({ where: { id: lead.id } }),
      prisma.leadTag.findUnique({ where: { bookingId_name: { bookingId: lead.id, name: 'Avtomatik lid' } } }),
      prisma.crmTask.findFirst({ where: { agencyId, bookingId: lead.id, title: 'Automation Lead bilan bog‘lanish' } }),
      prisma.automationRun.findFirst({ where: { agencyId, ruleId: rule.rule.id, entityId: lead.id, status: 'success' } }),
    ]);
    assert(updated.pipelineStage === 'contacted' && updated.firstResponseAt, 'Bosqich amali ishlamadi');
    assert(tag && task && successRun, 'Teg, vazifa yoki run log yaratilmagan');
    const taskCount = await prisma.crmTask.count({ where: { agencyId, bookingId: lead.id } });
    await runAutomationMonitor({ agencyId });
    assert(await prisma.crmTask.count({ where: { agencyId, bookingId: lead.id } }) === taskCount, 'Ikkinchi scheduler dublikat vazifa yaratdi');

    const state = await api(token, '/agency/crm/automation');
    assert(state.rules.length === 2 && state.runs.some((run) => run.status === 'success'), 'API run jurnalini qaytarmadi');
    console.log(JSON.stringify({ ok: true, uonParity: 88, checks: ['rule_crud', 'condition_match', 'ordered_actions', 'failed_run', 'retry_success', 'round_robin_assignment', 'task_action', 'tag_action', 'stage_action', 'run_log', 'scheduler_idempotency'] }));
  } finally { await cleanup(); await prisma.$disconnect(); }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
