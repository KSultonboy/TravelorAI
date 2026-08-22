const crypto = require('crypto');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { inspectCsv, mapCsv } = require('../services/crmCsv.service');
const { assignNextMember, getSettings, markFirstResponse, OPEN_STAGES } = require('../services/crmAutomation.service');
const { customStageKey, ensurePipelineStages, stageDto, stageTransitionData } = require('../services/crmPipeline.service');

function agencyOr404(req, res) {
  if (!req.agency?.id) { error(res, 'Agentlik topilmadi', 404); return null; }
  return req.agency;
}

async function ownedBooking(agencyId, bookingId) {
  return prisma.tourBooking.findFirst({ where: { id: String(bookingId), agencyId } });
}

async function validMember(agencyId, memberId) {
  if (!memberId) return null;
  return prisma.agencyMember.findFirst({ where: { id: String(memberId), agencyId, status: 'active' } });
}

function taskDto(task) {
  return {
    id: task.id,
    leadId: task.bookingId || undefined,
    leadName: task.booking?.customerName || undefined,
    title: task.title,
    dueAt: task.dueAt || undefined,
    done: !!task.completedAt,
    completedAt: task.completedAt || undefined,
    assignedMemberId: task.assignedMemberId || undefined,
    assignedMemberName: task.assignedMember?.name || undefined,
    createdAt: task.createdAt,
  };
}

async function bootstrap(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const [tasks, tags, activities, templates, requisite, members, pipelineStages] = await Promise.all([
      prisma.crmTask.findMany({
        where: { agencyId: agency.id },
        include: { booking: { select: { customerName: true } }, assignedMember: { select: { name: true } } },
        orderBy: [{ completedAt: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 2000,
      }),
      prisma.leadTag.findMany({ where: { agencyId: agency.id }, orderBy: { createdAt: 'asc' }, take: 10000 }),
      prisma.leadActivity.findMany({ where: { agencyId: agency.id }, orderBy: { createdAt: 'desc' }, take: 10000 }),
      prisma.documentTemplate.findMany({ where: { agencyId: agency.id }, orderBy: { type: 'asc' } }),
      prisma.agencyRequisite.findUnique({ where: { agencyId: agency.id } }),
      prisma.agencyMember.findMany({
        where: { agencyId: agency.id, status: 'active' },
        include: { account: { select: { email: true } } },
        orderBy: { name: 'asc' },
      }),
      ensurePipelineStages(agency.id),
    ]);
    return success(res, {
      tasks: tasks.map(taskDto), tags, activities, templates, requisite, pipelineStages,
      members: members.map((m) => ({ id: m.id, name: m.name, role: m.role, email: m.account.email })),
    });
  } catch (err) { return error(res, err.message, 500); }
}

function pipelineName(value) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 50); }
function pipelineColor(value) {
  const color = String(value || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : '#0F5132';
}

async function createPipelineStage(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const name = pipelineName(req.body?.name);
    if (name.length < 2) return error(res, 'Ustun nomi kamida 2 ta belgidan iborat bo‘lsin', 400);
    const existing = await ensurePipelineStages(agency.id);
    if (existing.length >= 12) return error(res, 'Kanbanda ko‘pi bilan 12 ta ustun bo‘lishi mumkin', 400);
    if (existing.some((stage) => stage.name.toLocaleLowerCase('uz').localeCompare(name.toLocaleLowerCase('uz')) === 0)) return error(res, 'Bu nomli ustun mavjud', 409);
    const maxPosition = existing.reduce((max, stage) => Math.max(max, stage.position), 0);
    const stage = await prisma.crmPipelineStage.create({
      data: { agencyId: agency.id, key: customStageKey(), name, hint: pipelineName(req.body?.hint) || null, color: pipelineColor(req.body?.color), position: maxPosition + 10 },
    });
    return success(res, { stage: stageDto(stage), stages: await ensurePipelineStages(agency.id) }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function updatePipelineStage(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const existing = await prisma.crmPipelineStage.findFirst({ where: { id: String(req.params.id), agencyId: agency.id } });
    if (!existing) return error(res, 'Kanban ustuni topilmadi', 404);
    const data = {};
    if (req.body?.name !== undefined) {
      const name = pipelineName(req.body.name);
      if (name.length < 2) return error(res, 'Ustun nomi kamida 2 ta belgidan iborat bo‘lsin', 400);
      const duplicate = await prisma.crmPipelineStage.findFirst({ where: { agencyId: agency.id, id: { not: existing.id }, name: { equals: name, mode: 'insensitive' } } });
      if (duplicate) return error(res, 'Bu nomli ustun mavjud', 409);
      data.name = name;
    }
    if (req.body?.hint !== undefined) data.hint = pipelineName(req.body.hint) || null;
    if (req.body?.color !== undefined) data.color = pipelineColor(req.body.color);
    if (!Object.keys(data).length) return error(res, 'O‘zgartirish topilmadi', 400);
    const stage = await prisma.crmPipelineStage.update({ where: { id: existing.id }, data });
    return success(res, { stage: stageDto(stage), stages: await ensurePipelineStages(agency.id) });
  } catch (err) { return error(res, err.message, 400); }
}

async function reorderPipelineStages(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const existing = await prisma.crmPipelineStage.findMany({ where: { agencyId: agency.id }, orderBy: { position: 'asc' } });
    if (ids.length !== existing.length || new Set(ids).size !== existing.length || existing.some((stage) => !ids.includes(stage.id))) return error(res, 'Ustunlar tartibi to‘liq yuborilishi kerak', 400);
    await prisma.$transaction(ids.map((id, index) => prisma.crmPipelineStage.update({ where: { id }, data: { position: (index + 1) * 10 } })));
    return success(res, { stages: await ensurePipelineStages(agency.id) });
  } catch (err) { return error(res, err.message, 400); }
}

async function deletePipelineStage(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const existing = await prisma.crmPipelineStage.findFirst({ where: { id: String(req.params.id), agencyId: agency.id } });
    if (!existing) return error(res, 'Kanban ustuni topilmadi', 404);
    if (existing.isSystem) return error(res, 'Asosiy tizim ustunini o‘chirib bo‘lmaydi; uning nomi va rangini o‘zgartiring', 400);
    const targetStageId = String(req.body?.targetStageId || '');
    const target = await prisma.crmPipelineStage.findFirst({ where: { id: targetStageId, agencyId: agency.id } });
    if (!target || target.id === existing.id) return error(res, 'Lidlarni ko‘chirish uchun boshqa ustunni tanlang', 400);
    const leads = await prisma.tourBooking.findMany({ where: { agencyId: agency.id, pipelineStage: existing.key }, select: { id: true, firstResponseAt: true, confirmedAt: true } });
    await prisma.$transaction(async (tx) => {
      if (leads.length) {
        for (const lead of leads) await tx.tourBooking.update({ where: { id: lead.id }, data: stageTransitionData(lead, target) });
        await tx.leadActivity.createMany({ data: leads.map((lead) => ({ agencyId: agency.id, bookingId: lead.id, actorAccountId: req.agencyAccount.id, type: 'stage', text: `Ustun o‘chirildi: ${existing.name} → ${target.name}` })) });
      }
      await tx.crmPipelineStage.delete({ where: { id: existing.id } });
    });
    return success(res, { deleted: true, movedLeads: leads.length, stages: await ensurePipelineStages(agency.id) });
  } catch (err) { return error(res, err.message, 400); }
}

async function createTask(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const title = String(req.body?.title || '').trim().slice(0, 300);
    if (!title) return error(res, 'Vazifa nomini kiriting', 400);
    const bookingId = req.body?.leadId ? String(req.body.leadId) : null;
    if (bookingId && !(await ownedBooking(agency.id, bookingId))) return error(res, 'Lid topilmadi', 404);
    const assignedMemberId = req.body?.assignedMemberId ? String(req.body.assignedMemberId) : null;
    if (assignedMemberId && !(await validMember(agency.id, assignedMemberId))) return error(res, 'Xodim topilmadi', 404);
    const dueAt = req.body?.dueAt ? new Date(req.body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) return error(res, 'Vazifa sanasi noto‘g‘ri', 400);
    const task = await prisma.crmTask.create({
      data: { agencyId: agency.id, bookingId, assignedMemberId, title, dueAt, createdByAccountId: req.agencyAccount.id },
      include: { booking: { select: { customerName: true } }, assignedMember: { select: { name: true } } },
    });
    return success(res, { task: taskDto(task) }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function updateTask(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const existing = await prisma.crmTask.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Vazifa topilmadi', 404);
    const data = {};
    if (req.body?.title !== undefined) {
      const title = String(req.body.title || '').trim().slice(0, 300);
      if (!title) return error(res, 'Vazifa nomini kiriting', 400);
      data.title = title;
    }
    if (req.body?.done !== undefined) data.completedAt = req.body.done ? new Date() : null;
    if (req.body?.dueAt !== undefined) {
      data.dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
      if (data.dueAt && Number.isNaN(data.dueAt.getTime())) return error(res, 'Vazifa sanasi noto‘g‘ri', 400);
    }
    if (req.body?.assignedMemberId !== undefined) {
      const memberId = req.body.assignedMemberId ? String(req.body.assignedMemberId) : null;
      if (memberId && !(await validMember(agency.id, memberId))) return error(res, 'Xodim topilmadi', 404);
      data.assignedMemberId = memberId;
    }
    const task = await prisma.crmTask.update({
      where: { id: existing.id }, data,
      include: { booking: { select: { customerName: true } }, assignedMember: { select: { name: true } } },
    });
    return success(res, { task: taskDto(task) });
  } catch (err) { return error(res, err.message, 400); }
}

async function deleteTask(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const existing = await prisma.crmTask.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Vazifa topilmadi', 404);
    await prisma.crmTask.delete({ where: { id: existing.id } });
    return success(res, { id: existing.id, deleted: true });
  } catch (err) { return error(res, err.message, 400); }
}

async function replaceTags(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const booking = await ownedBooking(agency.id, req.params.id);
    if (!booking) return error(res, 'Lid topilmadi', 404);
    const names = Array.from(new Set((Array.isArray(req.body?.tags) ? req.body.tags : [])
      .map((tag) => String(tag || '').trim().slice(0, 50)).filter(Boolean))).slice(0, 30);
    await prisma.$transaction([
      prisma.leadTag.deleteMany({ where: { agencyId: agency.id, bookingId: booking.id } }),
      ...(names.length ? [prisma.leadTag.createMany({ data: names.map((name) => ({ agencyId: agency.id, bookingId: booking.id, name })) })] : []),
    ]);
    return success(res, { bookingId: booking.id, tags: names });
  } catch (err) { return error(res, err.message, 400); }
}

async function addActivity(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const booking = await ownedBooking(agency.id, req.params.id);
    if (!booking) return error(res, 'Lid topilmadi', 404);
    const text = String(req.body?.text || '').trim().slice(0, 2000);
    if (!text) return error(res, 'Izoh matnini kiriting', 400);
    const allowed = ['note', 'stage', 'call', 'message', 'created', 'assignment', 'import'];
    const type = allowed.includes(req.body?.type) ? req.body.type : 'note';
    const activity = await prisma.leadActivity.create({
      data: { agencyId: agency.id, bookingId: booking.id, actorAccountId: req.agencyAccount.id, type, text },
    });
    if (['call', 'message', 'stage'].includes(type)) await markFirstResponse(booking.id);
    return success(res, { activity }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function assignLead(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const booking = await ownedBooking(agency.id, req.params.id);
    if (!booking) return error(res, 'Lid topilmadi', 404);
    const memberId = req.body?.memberId ? String(req.body.memberId) : null;
    const member = memberId ? await validMember(agency.id, memberId) : null;
    if (memberId && !member) return error(res, 'Xodim topilmadi', 404);
    const updated = await prisma.tourBooking.update({ where: { id: booking.id }, data: { assignedMemberId: memberId, branchId: member?.branchId || null } });
    await prisma.leadActivity.create({
      data: {
        agencyId: agency.id, bookingId: booking.id, actorAccountId: req.agencyAccount.id,
        type: 'assignment', text: member ? `Menejer biriktirildi: ${member.name}` : 'Menejer biriktirishi olib tashlandi',
      },
    });
    return success(res, { bookingId: updated.id, assignedMemberId: updated.assignedMemberId, assignedMemberName: member?.name || null });
  } catch (err) { return error(res, err.message, 400); }
}

async function saveDocuments(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const templates = req.body?.templates;
    const requisite = req.body?.requisite;
    const ops = [];
    if (templates && typeof templates === 'object') {
      for (const type of ['shartnoma', 'invoice']) {
        const item = templates[type];
        if (!item || typeof item !== 'object') continue;
        const content = String(item.body ?? item.note ?? '').slice(0, 50000);
        const name = String(item.title || type).slice(0, 300);
        ops.push(prisma.documentTemplate.upsert({
          where: { agencyId_type: { agencyId: agency.id, type } },
          create: { agencyId: agency.id, type, name, content, metadata: { title: name } },
          update: { name, content, metadata: { title: name } },
        }));
      }
    }
    if (requisite && typeof requisite === 'object') {
      const data = {
        legalName: String(requisite.legalName || '').slice(0, 300) || null,
        director: String(requisite.director || '').slice(0, 200) || null,
        address: String(requisite.address || '').slice(0, 500) || null,
        taxId: String(requisite.taxId ?? requisite.stir ?? '').slice(0, 50) || null,
        bankName: String(requisite.bankName || '').slice(0, 200) || null,
        bankAccount: String(requisite.bankAccount ?? requisite.account ?? '').slice(0, 100) || null,
        mfo: String(requisite.mfo || '').slice(0, 50) || null,
        phone: String(requisite.phone || '').slice(0, 50) || null,
        email: String(requisite.email || '').slice(0, 160) || null,
      };
      ops.push(prisma.agencyRequisite.upsert({ where: { agencyId: agency.id }, create: { agencyId: agency.id, ...data }, update: data }));
    }
    if (ops.length) await prisma.$transaction(ops);
    return bootstrap(req, res);
  } catch (err) { return error(res, err.message, 400); }
}

async function importLocal(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const b = req.body || {};
    const migrationId = String(b.migrationId || 'v1').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 120) || 'v1';
    const dedupeKey = `crm-local:${agency.id}:${migrationId}`;
    if (await prisma.auditLog.findUnique({ where: { dedupeKey } })) return success(res, { imported: false, alreadyImported: true });
    const taskLeadIds = (Array.isArray(b.tasks) ? b.tasks : []).map((task) => task?.leadId).filter(Boolean).map(String);
    const bookingIds = Array.from(new Set([...Object.keys(b.meta && typeof b.meta === 'object' ? b.meta : {}), ...taskLeadIds]));
    const validBookings = bookingIds.length ? await prisma.tourBooking.findMany({
      where: { agencyId: agency.id, id: { in: bookingIds.slice(0, 5000) } }, select: { id: true },
    }) : [];
    const allowed = new Set(validBookings.map((row) => row.id));
    let taskCount = 0; let tagCount = 0; let activityCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const task of (Array.isArray(b.tasks) ? b.tasks : []).slice(0, 2000)) {
        const externalId = String(task.id || '').slice(0, 160) || crypto.randomUUID();
        const bookingId = task.leadId && allowed.has(String(task.leadId)) ? String(task.leadId) : null;
        const dueAt = task.dueAt && !Number.isNaN(new Date(task.dueAt).getTime()) ? new Date(task.dueAt) : null;
        await tx.crmTask.upsert({
          where: { agencyId_externalId: { agencyId: agency.id, externalId } },
          create: { agencyId: agency.id, bookingId, title: String(task.title || 'Vazifa').slice(0, 300), dueAt, completedAt: task.done ? new Date() : null, externalId, createdByAccountId: req.agencyAccount.id },
          update: {},
        });
        taskCount += 1;
      }
      for (const [bookingId, meta] of Object.entries(b.meta && typeof b.meta === 'object' ? b.meta : {})) {
        if (!allowed.has(bookingId) || !meta || typeof meta !== 'object') continue;
        for (const name of Array.from(new Set((Array.isArray(meta.tags) ? meta.tags : []).map((tag) => String(tag || '').trim().slice(0, 50)).filter(Boolean))).slice(0, 30)) {
          await tx.leadTag.upsert({ where: { bookingId_name: { bookingId, name } }, create: { agencyId: agency.id, bookingId, name }, update: {} });
          tagCount += 1;
        }
        for (const activity of (Array.isArray(meta.activities) ? meta.activities : []).slice(0, 500)) {
          const externalId = String(activity.id || '').slice(0, 160) || crypto.randomUUID();
          const createdAt = activity.at && !Number.isNaN(new Date(activity.at).getTime()) ? new Date(activity.at) : new Date();
          await tx.leadActivity.upsert({
            where: { agencyId_externalId: { agencyId: agency.id, externalId } },
            create: { agencyId: agency.id, bookingId, actorAccountId: req.agencyAccount.id, type: String(activity.type || 'note').slice(0, 40), text: String(activity.text || '').slice(0, 2000) || 'Import qilindi', externalId, createdAt },
            update: {},
          });
          activityCount += 1;
        }
      }
      if (b.templates && typeof b.templates === 'object') {
        for (const type of ['shartnoma', 'invoice']) {
          const item = b.templates[type]; if (!item) continue;
          const name = String(item.title || type).slice(0, 300);
          const content = String(item.body ?? item.note ?? '').slice(0, 50000);
          await tx.documentTemplate.upsert({ where: { agencyId_type: { agencyId: agency.id, type } }, create: { agencyId: agency.id, type, name, content, metadata: { title: name } }, update: {} });
        }
      }
      if (b.requisite && typeof b.requisite === 'object') {
        const r = b.requisite;
        const data = { legalName: r.legalName || null, director: r.director || null, address: r.address || null, taxId: r.stir || r.taxId || null, bankName: r.bankName || null, bankAccount: r.account || r.bankAccount || null, mfo: r.mfo || null, phone: r.phone || null, email: r.email || null };
        await tx.agencyRequisite.upsert({ where: { agencyId: agency.id }, create: { agencyId: agency.id, ...data }, update: {} });
      }
      await tx.auditLog.create({ data: { agencyId: agency.id, actorAccountId: req.agencyAccount.id, actorEmail: req.agencyAccount.email, action: 'IMPORT localStorage', entityType: 'crm', changes: { taskCount, tagCount, activityCount }, dedupeKey } });
    });
    return success(res, { imported: true, taskCount, tagCount, activityCount });
  } catch (err) {
    if (err.code === 'P2002') return success(res, { imported: false, alreadyImported: true });
    return error(res, err.message, 400);
  }
}

function normalizedPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-12) : '';
}

function contactKey(row) {
  const phone = normalizedPhone(row.customerPhone || row.leadWhatsapp);
  if (phone) return `p:${phone}`;
  const email = String(row.customerEmail || '').trim().toLowerCase();
  return email ? `e:${email}` : '';
}

async function csvAnalysis(agencyId, csv, mapping) {
  const inspected = inspectCsv(csv);
  const parsed = mapCsv(csv, mapping);
  const existing = await prisma.tourBooking.findMany({
    where: { agencyId },
    select: { customerPhone: true, leadWhatsapp: true, customerEmail: true },
    take: 50000,
  });
  const existingKeys = new Set(existing.map(contactKey).filter(Boolean));
  const seen = new Set();
  const accepted = [];
  const preview = parsed.rows.map((row, index) => {
    const key = contactKey(row);
    let status = 'ready';
    if (key && existingKeys.has(key)) status = 'duplicate_db';
    else if (key && seen.has(key)) status = 'duplicate_file';
    if (key) seen.add(key);
    if (status === 'ready') accepted.push(row);
    return { row: index + 2, status, customerName: row.customerName, customerPhone: row.customerPhone, customerEmail: row.customerEmail, leadTour: row.leadTour };
  });
  return {
    inspected,
    parsed,
    accepted,
    preview,
    duplicateRows: preview.filter((item) => item.status !== 'ready').length,
  };
}

async function previewCsv(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const csv = String(req.body?.csv || '');
    if (!csv || csv.length > 5 * 1024 * 1024) return error(res, 'CSV fayl bo‘sh yoki 5 MB dan katta', 400);
    const analysis = await csvAnalysis(agency.id, csv, req.body?.mapping || {});
    return success(res, {
      headers: analysis.inspected.headers,
      suggestedMapping: analysis.inspected.suggestedMapping,
      sample: analysis.inspected.sample,
      preview: analysis.preview.slice(0, 200),
      totalRows: analysis.parsed.rows.length,
      readyRows: analysis.accepted.length,
      duplicateRows: analysis.duplicateRows,
      invalidRows: analysis.parsed.errors.length,
      warnings: analysis.parsed.errors.slice(0, 100),
    });
  } catch (err) { return error(res, err.message, 400); }
}

async function commitCsv(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const csv = String(req.body?.csv || '');
    if (!csv || csv.length > 5 * 1024 * 1024) return error(res, 'CSV fayl bo‘sh yoki 5 MB dan katta', 400);
    const mapping = req.body?.mapping || {};
    const analysis = await csvAnalysis(agency.id, csv, mapping);
    if (!analysis.accepted.length) return error(res, 'Yangi import qilinadigan lid topilmadi', 400, { duplicateRows: analysis.duplicateRows, warnings: analysis.parsed.errors });
    const members = await prisma.agencyMember.findMany({ where: { agencyId: agency.id, status: 'active' }, include: { account: { select: { email: true } } } });
    const byEmail = new Map(members.map((m) => [m.account.email.toLowerCase(), m.id]));
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.csvImportBatch.create({
        data: {
          agencyId: agency.id, actorAccountId: req.agencyAccount.id,
          fileName: String(req.body?.fileName || 'import.csv').slice(0, 255),
          totalRows: analysis.parsed.rows.length, importedRows: 0,
          duplicateRows: analysis.duplicateRows, invalidRows: analysis.parsed.errors.length,
          mapping, preview: analysis.preview.slice(0, 200),
        },
      });
      let imported = 0;
      for (const row of analysis.accepted) {
        let assignedMemberId = row.assignedEmail ? (byEmail.get(row.assignedEmail) || null) : null;
        if (!assignedMemberId) assignedMemberId = (await assignNextMember(agency.id, tx))?.id || null;
        await tx.tourBooking.create({ data: {
          agencyId: agency.id, tourId: null, csvImportBatchId: batch.id,
          customerName: row.customerName, customerPhone: row.customerPhone, customerEmail: row.customerEmail,
          travelers: row.travelers, travelDate: row.travelDate, message: row.message,
          totalEstimate: row.totalEstimate, currency: row.currency, source: 'csv',
          status: row.pipelineStage === 'won' ? 'confirmed' : row.pipelineStage === 'completed' ? 'completed' : row.pipelineStage === 'lost' ? 'rejected' : 'pending',
          pipelineStage: row.pipelineStage, leadTour: row.leadTour, leadCity: row.leadCity,
          leadTelegram: row.leadTelegram, leadWhatsapp: row.leadWhatsapp,
          customerBirthday: row.customerBirthday, assignedMemberId,
        } });
        imported += 1;
      }
      await tx.csvImportBatch.update({ where: { id: batch.id }, data: { importedRows: imported } });
      return { batchId: batch.id, imported };
    });
    return success(res, {
      ...result,
      skipped: analysis.duplicateRows + analysis.parsed.errors.length,
      duplicateRows: analysis.duplicateRows,
      warnings: analysis.parsed.errors.slice(0, 100),
    }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function importCsv(req, res) { return commitCsv(req, res); }

async function listCsvImports(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const items = await prisma.csvImportBatch.findMany({
      where: { agencyId: agency.id }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, fileName: true, status: true, totalRows: true, importedRows: true, duplicateRows: true, invalidRows: true, rolledBackAt: true, createdAt: true },
    });
    return success(res, { items });
  } catch (err) { return error(res, err.message, 500); }
}

async function rollbackCsv(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const batch = await prisma.csvImportBatch.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!batch) return error(res, 'Import topilmadi', 404);
    if (batch.status === 'rolled_back') return success(res, { rolledBack: false, alreadyRolledBack: true, deleted: 0 });
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.tourBooking.deleteMany({ where: { agencyId: agency.id, csvImportBatchId: batch.id, source: 'csv' } });
      await tx.csvImportBatch.update({ where: { id: batch.id }, data: { status: 'rolled_back', rolledBackAt: new Date() } });
      return deleted.count;
    });
    return success(res, { rolledBack: true, deleted: result });
  } catch (err) { return error(res, err.message, 400); }
}

async function getCrmSettings(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    return success(res, { settings: await getSettings(agency.id) });
  } catch (err) { return error(res, err.message, 500); }
}

async function saveCrmSettings(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const minutes = Math.max(5, Math.min(1440, parseInt(req.body?.firstResponseMinutes, 10) || 30));
    const settings = await prisma.agencyCrmSettings.upsert({
      where: { agencyId: agency.id },
      create: { agencyId: agency.id, firstResponseMinutes: minutes, autoAssignEnabled: !!req.body?.autoAssignEnabled, reminderEnabled: req.body?.reminderEnabled !== false },
      update: { firstResponseMinutes: minutes, autoAssignEnabled: !!req.body?.autoAssignEnabled, reminderEnabled: req.body?.reminderEnabled !== false },
    });
    return success(res, { settings });
  } catch (err) { return error(res, err.message, 400); }
}

async function insights(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 86400000);
    const [settings, rows] = await Promise.all([
      getSettings(agency.id),
      prisma.tourBooking.findMany({
        where: { agencyId: agency.id, createdAt: { gte: since } },
        select: { id: true, pipelineStage: true, createdAt: true, firstResponseAt: true, slaBreachedAt: true, totalEstimate: true, paidAmount: true, assignedMemberId: true, assignedMember: { select: { name: true } } },
        take: 50000,
      }),
    ]);
    const now = Date.now();
    const deadlineMs = settings.firstResponseMinutes * 60000;
    const unanswered = rows.filter((r) => OPEN_STAGES.includes(r.pipelineStage) && !r.firstResponseAt && now - new Date(r.createdAt).getTime() >= deadlineMs).length;
    const responseTimes = rows.filter((r) => r.firstResponseAt).map((r) => new Date(r.firstResponseAt).getTime() - new Date(r.createdAt).getTime()).filter((n) => n >= 0);
    const byManager = new Map();
    for (const row of rows) {
      const key = row.assignedMemberId || 'unassigned';
      const item = byManager.get(key) || { memberId: row.assignedMemberId, name: row.assignedMember?.name || 'Biriktirilmagan', leads: 0, won: 0, completed: 0, lost: 0, revenue: 0, responded: 0, responseMs: 0 };
      item.leads += 1;
      if (row.pipelineStage === 'won') item.won += 1;
      if (row.pipelineStage === 'completed') item.completed += 1;
      if (row.pipelineStage === 'lost') item.lost += 1;
      item.revenue += row.paidAmount || (['won', 'completed'].includes(row.pipelineStage) ? row.totalEstimate || 0 : 0);
      if (row.firstResponseAt) { item.responded += 1; item.responseMs += Math.max(0, new Date(row.firstResponseAt).getTime() - new Date(row.createdAt).getTime()); }
      byManager.set(key, item);
    }
    const managers = Array.from(byManager.values()).map((m) => ({ ...m, conversionPct: m.leads ? Math.round(((m.won + m.completed) / m.leads) * 1000) / 10 : 0, avgResponseMinutes: m.responded ? Math.round(m.responseMs / m.responded / 60000) : null })).sort((a, b) => b.revenue - a.revenue);
    return success(res, {
      periodDays: days, settings,
      totals: { leads: rows.length, won: rows.filter((r) => ['won', 'completed'].includes(r.pipelineStage)).length, lost: rows.filter((r) => r.pipelineStage === 'lost').length, unanswered, slaBreached: rows.filter((r) => r.slaBreachedAt).length, avgResponseMinutes: responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 60000) : null },
      managers,
    });
  } catch (err) { return error(res, err.message, 500); }
}

async function listAudit(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const where = { agencyId: agency.id };
    if (req.query.actor) where.actorEmail = { contains: String(req.query.actor), mode: 'insensitive' };
    if (req.query.action) where.action = { contains: String(req.query.action), mode: 'insensitive' };
    if (req.query.entityType) where.entityType = String(req.query.entityType);
    if (req.query.from || req.query.to) where.createdAt = {};
    if (req.query.from) where.createdAt.gte = new Date(String(req.query.from));
    if (req.query.to) { const to = new Date(String(req.query.to)); to.setHours(23, 59, 59, 999); where.createdAt.lte = to; }
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.auditLog.count({ where }),
    ]);
    return success(res, { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) { return error(res, err.message, 500); }
}

module.exports = { addActivity, assignLead, bootstrap, commitCsv, createPipelineStage, createTask, deletePipelineStage, deleteTask, getCrmSettings, importCsv, importLocal, insights, listAudit, listCsvImports, previewCsv, reorderPipelineStages, replaceTags, rollbackCsv, saveCrmSettings, saveDocuments, updatePipelineStage, updateTask };
