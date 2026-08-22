const crypto = require('crypto');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { mapCsv } = require('../services/crmCsv.service');

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
    const [tasks, tags, activities, templates, requisite, members] = await Promise.all([
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
    ]);
    return success(res, {
      tasks: tasks.map(taskDto), tags, activities, templates, requisite,
      members: members.map((m) => ({ id: m.id, name: m.name, role: m.role, email: m.account.email })),
    });
  } catch (err) { return error(res, err.message, 500); }
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
    const updated = await prisma.tourBooking.update({ where: { id: booking.id }, data: { assignedMemberId: memberId } });
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

async function importCsv(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const csv = String(req.body?.csv || '');
    if (!csv || csv.length > 5 * 1024 * 1024) return error(res, 'CSV fayl bo‘sh yoki 5 MB dan katta', 400);
    const parsed = mapCsv(csv);
    if (!parsed.rows.length) return error(res, parsed.errors[0] || 'Import qilinadigan qator topilmadi', 400, { errors: parsed.errors });
    const members = await prisma.agencyMember.findMany({ where: { agencyId: agency.id, status: 'active' }, include: { account: { select: { email: true } } } });
    const byEmail = new Map(members.map((m) => [m.account.email.toLowerCase(), m.id]));
    const records = parsed.rows.map((row) => ({
      agencyId: agency.id, tourId: null, customerName: row.customerName, customerPhone: row.customerPhone,
      customerEmail: row.customerEmail, travelers: row.travelers, travelDate: row.travelDate, message: row.message,
      totalEstimate: row.totalEstimate, currency: row.currency, source: 'csv', status: row.pipelineStage === 'won' ? 'confirmed' : row.pipelineStage === 'completed' ? 'completed' : row.pipelineStage === 'lost' ? 'rejected' : 'pending',
      pipelineStage: row.pipelineStage, leadTour: row.leadTour, leadCity: row.leadCity, leadTelegram: row.leadTelegram,
      leadWhatsapp: row.leadWhatsapp, customerBirthday: row.customerBirthday, assignedMemberId: row.assignedEmail ? (byEmail.get(row.assignedEmail) || null) : null,
    }));
    const result = await prisma.tourBooking.createMany({ data: records });
    return success(res, { imported: result.count, skipped: parsed.rows.length - result.count, warnings: parsed.errors.slice(0, 100) }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function listAudit(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 100));
    const items = await prisma.auditLog.findMany({ where: { agencyId: agency.id }, orderBy: { createdAt: 'desc' }, take: limit });
    return success(res, { items });
  } catch (err) { return error(res, err.message, 500); }
}

module.exports = { addActivity, assignLead, bootstrap, createTask, deleteTask, importCsv, importLocal, listAudit, replaceTags, saveDocuments, updateTask };
