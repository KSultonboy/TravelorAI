const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { recordAudit } = require('../services/audit.service');
const { enqueueWebhookEvent } = require('../services/webhookDelivery.service');
const { ensurePipelineStages, findPipelineStage, stageTransitionData } = require('../services/crmPipeline.service');

const LEAD_SELECT = {
  id: true, customerName: true, customerEmail: true, customerPhone: true, travelers: true,
  travelDate: true, message: true, status: true, totalEstimate: true, currency: true,
  source: true, pipelineStage: true, leadTour: true, leadCity: true, agencyNote: true,
  assignedMemberId: true, firstResponseAt: true, createdAt: true, updatedAt: true,
};

function paging(query) {
  return { page: Math.max(1, Number(query.page) || 1), limit: Math.min(100, Math.max(1, Number(query.limit) || 50)) };
}

async function listLeads(req, res) {
  try {
    const { page, limit } = paging(req.query);
    let requestedStage = null;
    if (req.query.stage) {
      await ensurePipelineStages(req.agency.id);
      requestedStage = await findPipelineStage(req.agency.id, String(req.query.stage));
      if (!requestedStage) return error(res, 'stage yaroqsiz', 400);
    }
    const where = {
      agencyId: req.agency.id,
      archived: req.query.archived === 'true',
      ...(requestedStage ? { pipelineStage: requestedStage.key } : {}),
      ...(req.query.updatedAfter ? { updatedAt: { gt: new Date(req.query.updatedAfter) } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.tourBooking.findMany({ where, select: LEAD_SELECT, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.tourBooking.count({ where }),
    ]);
    return success(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { return error(res, err.message, 400); }
}

async function getLead(req, res) {
  try {
    const lead = await prisma.tourBooking.findFirst({ where: { id: req.params.id, agencyId: req.agency.id }, select: { ...LEAD_SELECT, leadTags: { select: { name: true } }, activities: { orderBy: { createdAt: 'desc' }, take: 50 } } });
    if (!lead) return error(res, 'Lid topilmadi', 404);
    return success(res, lead);
  } catch (err) { return error(res, err.message, 400); }
}

async function createLead(req, res) {
  try {
    const customerName = String(req.body?.customerName || '').trim();
    const customerPhone = String(req.body?.customerPhone || '').trim();
    const customerEmail = String(req.body?.customerEmail || '').trim().toLowerCase();
    if (!customerName || (!customerPhone && !customerEmail)) return error(res, 'customerName va telefon yoki email talab qilinadi', 400);
    const travelDate = req.body?.travelDate ? new Date(req.body.travelDate) : null;
    if (travelDate && Number.isNaN(travelDate.getTime())) return error(res, 'travelDate yaroqsiz', 400);
    const lead = await prisma.tourBooking.create({
      data: {
        agencyId: req.agency.id, customerName: customerName.slice(0, 200),
        customerPhone: customerPhone.slice(0, 50) || null, customerEmail: customerEmail.slice(0, 200) || null,
        travelers: Math.min(100, Math.max(1, Number(req.body?.travelers) || 1)), travelDate,
        message: String(req.body?.message || '').slice(0, 5000) || null,
        leadTour: String(req.body?.leadTour || '').slice(0, 300) || null,
        leadCity: String(req.body?.leadCity || '').slice(0, 100) || null,
        totalEstimate: req.body?.totalEstimate == null ? null : Math.max(0, Math.round(Number(req.body.totalEstimate) || 0)),
        currency: String(req.body?.currency || 'USD').toUpperCase().slice(0, 3), source: 'api',
      }, select: LEAD_SELECT,
    });
    await Promise.all([
      recordAudit({ agencyId: req.agency.id, action: 'POST public-api-leads', entityType: 'leads', entityId: lead.id, requestPath: req.originalUrl, requestMethod: 'POST', actorEmail: `api:${req.publicApiKey.keyPrefix}`, changes: { body: req.body } }),
      enqueueWebhookEvent({ agencyId: req.agency.id, type: 'lead.created', entityType: 'lead', entityId: lead.id, payload: lead }),
    ]);
    return success(res, lead, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function updateLead(req, res) {
  try {
    const current = await prisma.tourBooking.findFirst({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!current) return error(res, 'Lid topilmadi', 404);
    const data = {};
    for (const field of ['customerName', 'customerEmail', 'customerPhone', 'message', 'leadTour', 'leadCity', 'agencyNote']) {
      if (req.body?.[field] !== undefined) data[field] = String(req.body[field] || '').trim().slice(0, field === 'message' || field === 'agencyNote' ? 5000 : 300) || null;
    }
    if (req.body?.travelers !== undefined) data.travelers = Math.min(100, Math.max(1, Number(req.body.travelers) || 1));
    if (req.body?.totalEstimate !== undefined) data.totalEstimate = req.body.totalEstimate == null ? null : Math.max(0, Math.round(Number(req.body.totalEstimate) || 0));
    if (req.body?.currency !== undefined) data.currency = String(req.body.currency).toUpperCase().slice(0, 3);
    if (req.body?.travelDate !== undefined) {
      const date = req.body.travelDate ? new Date(req.body.travelDate) : null;
      if (date && Number.isNaN(date.getTime())) return error(res, 'travelDate yaroqsiz', 400);
      data.travelDate = date;
    }
    let eventType = 'lead.updated';
    if (req.body?.pipelineStage !== undefined) {
      await ensurePipelineStages(req.agency.id);
      const stage = await findPipelineStage(req.agency.id, String(req.body.pipelineStage));
      if (!stage) return error(res, 'pipelineStage yaroqsiz', 400);
      Object.assign(data, stageTransitionData(current, stage)); eventType = 'lead.stage_changed';
    }
    if (!Object.keys(data).length) return error(res, 'O‘zgartiriladigan maydon topilmadi', 400);
    const lead = await prisma.tourBooking.update({ where: { id: current.id }, data, select: LEAD_SELECT });
    await Promise.all([
      recordAudit({ agencyId: req.agency.id, action: 'PATCH public-api-leads', entityType: 'leads', entityId: lead.id, requestPath: req.originalUrl, requestMethod: 'PATCH', actorEmail: `api:${req.publicApiKey.keyPrefix}`, changes: { body: req.body } }),
      enqueueWebhookEvent({ agencyId: req.agency.id, type: eventType, entityType: 'lead', entityId: lead.id, payload: lead }),
    ]);
    return success(res, lead);
  } catch (err) { return error(res, err.message, 400); }
}

async function listTours(req, res) {
  try {
    const { page, limit } = paging(req.query);
    const where = { agencyId: req.agency.id, active: true, approvalStatus: 'approved' };
    const [items, total] = await Promise.all([
      prisma.tour.findMany({ where, select: { id: true, slug: true, title: true, subtitle: true, description: true, city: true, destinationCountry: true, price: true, priceMin: true, priceCurrency: true, duration: true, days: true, nights: true, imageUrl: true, badge: true, availabilityStatus: true, stopSale: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.tour.count({ where }),
    ]);
    return success(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { return error(res, err.message, 400); }
}

async function listFinance(req, res) {
  try {
    const { page, limit } = paging(req.query);
    const where = { agencyId: req.agency.id, ...(req.query.status ? { status: String(req.query.status) } : {}) };
    const [items, total] = await Promise.all([
      prisma.financeTransaction.findMany({ where, select: { id: true, accountId: true, bookingId: true, direction: true, status: true, category: true, amount: true, currency: true, counterparty: true, paymentMethod: true, dueAt: true, paidAt: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.financeTransaction.count({ where }),
    ]);
    return success(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { return error(res, err.message, 400); }
}

module.exports = { listLeads, getLead, createLead, updateLead, listTours, listFinance };
