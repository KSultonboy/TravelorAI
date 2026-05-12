const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');

function extractPlan(body) {
  return body?.plan && typeof body.plan === 'object' ? body.plan : body;
}

function normalizeProgress(progress, fallback = {}) {
  const source = progress && typeof progress === 'object' ? progress : fallback || {};
  return {
    visitedStopIds: Array.isArray(source.visitedStopIds)
      ? Array.from(new Set(source.visitedStopIds.map((item) => String(item || '').trim()).filter(Boolean)))
      : [],
    notes:
      source.notes && typeof source.notes === 'object' && !Array.isArray(source.notes)
        ? source.notes
        : {},
    updatedAt: String(source.updatedAt || new Date().toISOString()),
  };
}

function normalizePlanForStorage(plan, existingPlan = {}) {
  const now = new Date().toISOString();
  const base = existingPlan && typeof existingPlan === 'object' ? existingPlan : {};
  const next = plan && typeof plan === 'object' ? plan : {};
  return {
    ...base,
    ...next,
    status: String(next.status || base.status || 'final'),
    source: String(next.source || base.source || 'backend'),
    syncStatus: 'synced',
    progress: normalizeProgress(next.progress, base.progress),
    createdAt: String(next.createdAt || base.createdAt || now),
    updatedAt: now,
  };
}

function buildTripPayload(plan, options = {}) {
  const { includeId = true } = options;
  const normalizedPlan = normalizePlanForStorage(plan);
  const title = plan.title || 'Sayohat rejasi';
  const totalCost = Number(plan.totalCost || 0);
  const travelers = Number(plan.travelers || 1);
  const duration = Number(plan.duration || 1);
  const perPersonCost = Number(plan.perPersonCost || Math.round(totalCost / Math.max(travelers, 1)));
  const budgetUsed = Number(plan.budgetUsed || 0);
  const budgetRemaining = Number(plan.budgetRemaining || 0);
  const style = String(plan.style || 'mid');

  return {
    ...(includeId && typeof plan.id === 'string' && plan.id.trim() ? { id: plan.id.trim() } : {}),
    title,
    totalCost: Math.round(totalCost),
    travelers,
    duration,
    perPersonCost: Math.round(perPersonCost),
    budgetUsed,
    budgetRemaining: Math.round(budgetRemaining),
    style,
    planData: normalizedPlan,
  };
}

async function getAll(req, res) {
  try {
    const status = String(req.query.status || '').trim();
    const q = String(req.query.q || req.query.search || '').trim().toLowerCase();
    const limit = Math.max(0, Math.min(Number(req.query.limit || 0) || 0, 200));
    const trips = await prisma.trip.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });

    const filtered = trips.filter((trip) => {
      const planData = trip.planData && typeof trip.planData === 'object' ? trip.planData : {};
      const tripStatus = String(planData.status || '');
      const haystack = `${trip.title} ${Array.isArray(planData.destinations) ? planData.destinations.join(' ') : ''}`.toLowerCase();
      if (status && tripStatus !== status) return false;
      if (q && !haystack.includes(q)) return false;
      return true;
    });

    return success(res, limit ? filtered.slice(0, limit) : filtered);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getOne(req, res) {
  try {
    const { id } = req.params;
    const trip = await prisma.trip.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!trip) return error(res, 'Trip topilmadi', 404);
    return success(res, trip);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function create(req, res) {
  try {
    const plan = extractPlan(req.body);
    if (!plan || typeof plan !== 'object') {
      return error(res, 'Trip rejasi topilmadi.', 422);
    }

    const trip = await prisma.trip.create({
      data: {
        userId: req.user.id,
        ...buildTripPayload(plan),
      },
    });
    return success(res, trip, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const plan = extractPlan(req.body);
    if (!plan || typeof plan !== 'object') {
      return error(res, 'Trip rejasi topilmadi.', 422);
    }

    const existing = await prisma.trip.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return error(res, 'Trip topilmadi', 404);

    const mergedPlan = {
      ...(existing.planData && typeof existing.planData === 'object' ? existing.planData : {}),
      ...plan,
    };

    const trip = await prisma.trip.update({
      where: { id },
      data: {
        ...buildTripPayload(mergedPlan, { includeId: false }),
      },
    });

    return success(res, trip);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function updateProgress(req, res) {
  try {
    const { id } = req.params;
    const existing = await prisma.trip.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return error(res, 'Trip topilmadi', 404);

    const existingPlan = existing.planData && typeof existing.planData === 'object' ? existing.planData : {};
    const progress = normalizeProgress(req.body?.progress || req.body, existingPlan.progress);
    const mergedPlan = normalizePlanForStorage({ ...existingPlan, progress }, existingPlan);

    const trip = await prisma.trip.update({
      where: { id },
      data: buildTripPayload(mergedPlan, { includeId: false }),
    });

    return success(res, trip);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function duplicate(req, res) {
  try {
    const { id } = req.params;
    const existing = await prisma.trip.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return error(res, 'Trip topilmadi', 404);

    const existingPlan = existing.planData && typeof existing.planData === 'object' ? existing.planData : {};
    const now = new Date().toISOString();
    const copyPlan = normalizePlanForStorage(
      {
        ...existingPlan,
        id: undefined,
        title: `${existingPlan.title || existing.title} nusxasi`,
        status: 'draft',
        progress: { visitedStopIds: [], notes: {}, updatedAt: now },
        createdAt: now,
        updatedAt: now,
      },
      {}
    );

    delete copyPlan.id;

    const trip = await prisma.trip.create({
      data: {
        userId: req.user.id,
        ...buildTripPayload(copyPlan, { includeId: false }),
      },
    });

    return success(res, trip, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function archive(req, res) {
  try {
    const { id } = req.params;
    const existing = await prisma.trip.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return error(res, 'Trip topilmadi', 404);

    const existingPlan = existing.planData && typeof existing.planData === 'object' ? existing.planData : {};
    const archived = req.body?.archived !== false;
    const nextStatus = archived ? 'archived' : String(req.body?.status || existingPlan.status || 'draft');
    const mergedPlan = normalizePlanForStorage({ ...existingPlan, status: nextStatus }, existingPlan);
    const trip = await prisma.trip.update({
      where: { id },
      data: buildTripPayload(mergedPlan, { includeId: false }),
    });

    return success(res, trip);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const trip = await prisma.trip.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!trip) return error(res, 'Trip topilmadi', 404);

    await prisma.trip.delete({ where: { id } });
    return success(res, { success: true });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = { getAll, getOne, create, update, updateProgress, duplicate, archive, remove };
