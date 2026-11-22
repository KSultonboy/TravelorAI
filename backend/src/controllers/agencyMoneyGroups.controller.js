// To'lov jadvali (avans / bo'lib to'lash / qarzdorlik) va guruh jo'nash ro'yxati.
// Har bir so'rov req.agency.id bilan cheklanadi: boshqa agentlik yozuvi 404.
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { cleanCurrency } = require('../services/finance.service');
const { recordAudit } = require('../services/audit.service');
const schedule = require('../services/paymentSchedule.service');
const groups = require('../services/groupList.service');
const { createInstalmentSchema, groupListQuerySchema, markPaidSchema, parseOrError, planSchema, updateInstalmentSchema } = require('../schemas/moneyGroups.schema');

const { HttpError } = schedule;

function fail(res, err) {
  if (err instanceof HttpError) return error(res, err.message, err.status, err.extra);
  return error(res, err.message || 'Server xatosi', 500);
}

const ownedBooking = (agencyId, id) => prisma.tourBooking.findFirst({
  where: { id: String(id || ''), agencyId },
  select: { id: true, customerName: true, totalEstimate: true, currency: true, telegramChatId: true },
});

/* ───────────── To'lov jadvali ───────────── */

async function listInstalments(req, res) {
  try {
    const agencyId = req.agency.id;
    const booking = await ownedBooking(agencyId, req.params.id);
    if (!booking) return error(res, 'Lid topilmadi', 404);
    const canWrite = schedule.WRITE_ROLES.includes(req.memberRole);
    const [rows, accounts] = await Promise.all([
      prisma.paymentInstalment.findMany({ where: { agencyId, bookingId: booking.id }, orderBy: [{ dueDate: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] }),
      // Kassa/hisoblar faqat to'lovni qayd eta oladigan rollarga kerak (agent moliya bo'limini ko'rmaydi).
      canWrite ? prisma.financeAccount.findMany({ where: { agencyId, active: true }, select: { id: true, name: true, type: true, currency: true }, orderBy: [{ currency: 'asc' }, { name: 'asc' }] }) : [],
    ]);
    const today = schedule.tashkentToday();
    return success(res, {
      booking: { id: booking.id, customerName: booking.customerName, totalEstimate: booking.totalEstimate, currency: booking.currency, hasTelegram: !!booking.telegramChatId },
      instalments: rows.map((row) => schedule.decorateInstalment(row, today)),
      summary: schedule.summarizeLead(rows, today),
      accounts,
      canWrite,
    });
  } catch (err) { return fail(res, err); }
}

async function createInstalment(req, res) {
  try {
    const parsed = parseOrError(createInstalmentSchema, req.body); if (parsed.error) return error(res, parsed.error, 400);
    const agencyId = req.agency.id;
    const booking = await ownedBooking(agencyId, req.params.id);
    if (!booking) return error(res, 'Lid topilmadi', 404);
    const body = parsed.data;
    const count = await prisma.paymentInstalment.count({ where: { agencyId, bookingId: booking.id } });
    if (count >= 60) return error(res, 'Bir lid uchun ko‘pi bilan 60 ta to‘lov bo‘lagi', 400);
    const instalment = await prisma.paymentInstalment.create({ data: {
      agencyId, bookingId: booking.id, title: body.title, amount: body.amount,
      currency: cleanCurrency(body.currency || booking.currency), dueDate: body.dueDate,
      note: body.note || null, position: count, createdByAccountId: req.agencyAccount?.id || null,
    } });
    return success(res, { instalment: schedule.decorateInstalment(instalment) }, 201);
  } catch (err) { return fail(res, err); }
}

async function generateInstalmentPlan(req, res) {
  try {
    const parsed = parseOrError(planSchema, req.body); if (parsed.error) return error(res, parsed.error, 400);
    const agencyId = req.agency.id;
    const booking = await ownedBooking(agencyId, req.params.id);
    if (!booking) return error(res, 'Lid topilmadi', 404);
    const body = parsed.data;
    const currency = cleanCurrency(body.currency || booking.currency);
    const plan = schedule.generatePlan(body).map((row) => ({ ...row, currency }));
    if (body.dryRun) return success(res, { preview: true, instalments: plan });

    const created = await prisma.$transaction(async (tx) => {
      const planned = await tx.paymentInstalment.count({ where: { agencyId, bookingId: booking.id, status: 'planned' } });
      if (planned && !body.replace) throw new HttpError('Bu lid uchun to‘lov jadvali allaqachon bor. Almashtirish uchun «replace» ni yoqing.', 409, { code: 'PLAN_EXISTS' });
      // Faqat rejalashtirilgan bo'laklar almashtiriladi — to'langanlar moliya tarixida qoladi.
      if (planned) await tx.paymentInstalment.deleteMany({ where: { agencyId, bookingId: booking.id, status: 'planned' } });
      const offset = await tx.paymentInstalment.count({ where: { agencyId, bookingId: booking.id } });
      await tx.paymentInstalment.createMany({ data: plan.map((row) => ({
        agencyId, bookingId: booking.id, title: row.title, amount: row.amount, currency, dueDate: row.dueDate,
        position: offset + row.position, createdByAccountId: req.agencyAccount?.id || null,
      })) });
      return tx.paymentInstalment.findMany({ where: { agencyId, bookingId: booking.id }, orderBy: [{ dueDate: 'asc' }, { position: 'asc' }] });
    });
    return success(res, { instalments: created.map((row) => schedule.decorateInstalment(row)) }, 201);
  } catch (err) { return fail(res, err); }
}

async function updateInstalment(req, res) {
  try {
    const parsed = parseOrError(updateInstalmentSchema, req.body); if (parsed.error) return error(res, parsed.error, 400);
    const agencyId = req.agency.id;
    const existing = await prisma.paymentInstalment.findFirst({ where: { id: String(req.params.id), agencyId } });
    if (!existing) return error(res, 'To‘lov bo‘lagi topilmadi', 404);
    const body = parsed.data;
    if (existing.status === 'paid' && (body.amount !== undefined || body.dueDate !== undefined || body.status !== undefined)) {
      return error(res, 'To‘langan bo‘lakning summasi, sanasi va holati o‘zgarmaydi. Kerak bo‘lsa moliya bo‘limida tranzaksiyani bekor qiling.', 409);
    }
    const data = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.note !== undefined) data.note = body.note || null;
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.status !== undefined) data.status = body.status;
    if (body.dueDate !== undefined) {
      data.dueDate = body.dueDate;
      // Sana o'zgarsa mijoz yangi sana bo'yicha qayta eslatma oladi.
      if (+new Date(existing.dueDate) !== +body.dueDate) data.reminderSentAt = null;
    }
    const instalment = await prisma.paymentInstalment.update({ where: { id: existing.id }, data });
    return success(res, { instalment: schedule.decorateInstalment(instalment) });
  } catch (err) { return fail(res, err); }
}

async function deleteInstalment(req, res) {
  try {
    const agencyId = req.agency.id;
    const existing = await prisma.paymentInstalment.findFirst({ where: { id: String(req.params.id), agencyId } });
    if (!existing) return error(res, 'To‘lov bo‘lagi topilmadi', 404);
    if (existing.status === 'paid') return error(res, 'To‘langan bo‘lakni o‘chirib bo‘lmaydi — u moliya hisobotida turibdi.', 409);
    await prisma.paymentInstalment.delete({ where: { id: existing.id } });
    return success(res, { id: existing.id, deleted: true });
  } catch (err) { return fail(res, err); }
}

async function payInstalment(req, res) {
  try {
    const parsed = parseOrError(markPaidSchema, req.body); if (parsed.error) return error(res, parsed.error, 400);
    const body = parsed.data;
    const result = await schedule.markInstalmentPaid({
      agencyId: req.agency.id, instalmentId: String(req.params.id), actorAccountId: req.agencyAccount?.id,
      accountId: body.accountId || null, paidAmount: body.paidAmount, paidAt: body.paidAt,
      paymentMethod: body.paymentMethod, note: body.note,
    });
    return success(res, {
      instalment: result.instalment ? schedule.decorateInstalment(result.instalment) : null,
      transactionId: result.transactionId, remainder: result.remainder || null, alreadyPaid: result.alreadyPaid,
    }, result.alreadyPaid ? 200 : 201);
  } catch (err) { return fail(res, err); }
}

async function debts(req, res) {
  try {
    return success(res, await schedule.loadDebts(req.agency.id));
  } catch (err) { return fail(res, err); }
}

/* ───────────── Guruh ro'yxati ───────────── */

async function groupList(req, res) {
  try {
    const parsed = parseOrError(groupListQuerySchema, req.query); if (parsed.error) return error(res, parsed.error, 400);
    return success(res, await groups.loadGroupList(req.agency.id, parsed.data));
  } catch (err) { return fail(res, err); }
}

async function exportGroupList(req, res) {
  try {
    const parsed = parseOrError(groupListQuerySchema, req.query); if (parsed.error) return error(res, parsed.error, 400);
    const data = await groups.loadGroupList(req.agency.id, parsed.data);
    const csv = groups.buildGroupCsv(data.rows);
    const filename = groups.csvFilename(data.tour, data.date);
    // GET so'rovi agencyAudit middleware'iga tushmaydi — pasport eksporti qo'lda
    // jurnallanadi. Faqat hisoblagichlar yoziladi, pasport ma'lumoti/fayl tanasi YO'Q.
    await recordAudit({
      agencyId: req.agency.id, actorAccountId: req.agencyAccount?.id, actorEmail: req.agencyAccount?.email,
      action: 'EXPORT group-list', entityType: 'tours', entityId: data.tour.id,
      requestPath: req.originalUrl || req.path, requestMethod: req.method,
      changes: { date: data.date, rows: data.rows.length, passports: data.summary.passports, warnings: data.summary.rowsWithWarnings },
      ipAddress: req.ip, userAgent: req.get ? req.get('user-agent') : null,
    });
    return success(res, { filename, csv, rows: data.rows.length });
  } catch (err) { return fail(res, err); }
}

module.exports = { createInstalment, debts, deleteInstalment, exportGroupList, generateInstalmentPlan, groupList, listInstalments, payInstalment, updateInstalment };
