// Engagement sozlamalari (CRM → Sozlamalar → Xabarnomalar) va admin sinov boshqaruvi.
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { getSettings } = require('../services/crmAutomation.service');
const { sendTestDigest, testsLeftToday } = require('../services/weeklyDigest.service');
const { extendTrial } = require('../services/trial.service');
const { resolveAccess } = require('../config/agencyPlans');

function agencyOr404(req, res) {
  if (!req.agency?.id) { error(res, 'Agentlik topilmadi', 404); return null; }
  return req.agency;
}

function view(agency, settings, access) {
  return {
    leadAlertsEnabled: settings.leadAlertsEnabled !== false,
    weeklyDigestEnabled: settings.weeklyDigestEnabled !== false,
    botConnected: !!(agency.telegramBotActive && agency.telegramBotToken),
    notifyConnected: !!(agency.telegramBotActive && agency.telegramBotToken && agency.notifyChatId),
    digestTestsLeft: testsLeftToday(settings),
    accessState: access?.accessState || null,
    trialEndsAt: access?.trialEndsAt || null,
  };
}

async function getEngagementSettings(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const settings = await getSettings(agency.id);
    return success(res, view(agency, settings, req.access));
  } catch (err) { return error(res, err.message, 500); }
}

async function saveEngagementSettings(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const data = {};
    for (const key of ['leadAlertsEnabled', 'weeklyDigestEnabled']) {
      if (req.body?.[key] === undefined) continue;
      if (typeof req.body[key] !== 'boolean') return error(res, `${key} true yoki false bo‘lishi kerak`, 400);
      data[key] = req.body[key];
    }
    if (!Object.keys(data).length) return error(res, 'O‘zgartirish uchun maydon yuborilmadi', 400);
    const settings = await prisma.agencyCrmSettings.upsert({
      where: { agencyId: agency.id },
      create: { agencyId: agency.id, ...data },
      update: data,
    });
    return success(res, view(agency, settings, req.access));
  } catch (err) { return error(res, err.message, 400); }
}

async function sendDigestNow(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const digest = await sendTestDigest(agency);
    const settings = await getSettings(agency.id);
    return success(res, { sent: true, digest, digestTestsLeft: testsLeftToday(settings) });
  } catch (err) {
    return error(res, err.message, err.status || 400, err.code ? { code: err.code } : {});
  }
}

/* ───────── admin ───────── */

async function adminListTrials(req, res) {
  try {
    const items = await prisma.tourAgency.findMany({
      where: { trialEndsAt: { not: null } },
      orderBy: { trialEndsAt: 'asc' },
      select: {
        id: true, name: true, city: true, trialEndsAt: true, trialReminderStage: true,
        tariffId: true, subscriptionStatus: true, subscriptionUntil: true, createdAt: true,
        tariff: { select: { slug: true, name: true } },
      },
      take: 500,
    });
    return success(res, {
      items: items.map((a) => {
        const access = resolveAccess(a, 'owner');
        return { ...a, accessState: access.accessState, daysLeft: access.accessState.startsWith('trial') ? access.daysLeft : null };
      }),
      total: items.length,
    });
  } catch (err) { return error(res, err.message, 500); }
}

async function adminExtendTrial(req, res) {
  try {
    const item = await extendTrial(req.params.id, req.body?.days);
    return success(res, item);
  } catch (err) { return error(res, err.message, err.status || 500); }
}

module.exports = { getEngagementSettings, saveEngagementSettings, sendDigestNow, adminListTrials, adminExtendTrial };
