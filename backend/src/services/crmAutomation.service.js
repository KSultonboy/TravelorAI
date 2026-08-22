const { prisma } = require('../config/database');

const OPEN_STAGES = ['new', 'contacted', 'quoted'];

async function getSettings(agencyId, client = prisma) {
  return client.agencyCrmSettings.upsert({
    where: { agencyId },
    create: { agencyId },
    update: {},
  });
}

async function assignNextMember(agencyId, client = prisma, force = false) {
  const settings = await getSettings(agencyId, client);
  if (!force && !settings.autoAssignEnabled) return null;
  const members = await client.agencyMember.findMany({
    where: { agencyId, status: 'active', role: { in: ['manager', 'agent'] } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true },
  });
  if (!members.length) return null;
  const index = Math.abs(settings.roundRobinCursor || 0) % members.length;
  const member = members[index];
  await client.agencyCrmSettings.update({
    where: { agencyId },
    data: { roundRobinCursor: (index + 1) % members.length },
  });
  return member;
}

async function markFirstResponse(bookingId, client = prisma) {
  if (!bookingId) return null;
  return client.tourBooking.updateMany({
    where: { id: bookingId, firstResponseAt: null },
    data: { firstResponseAt: new Date() },
  });
}

async function runSlaMonitor() {
  const agencies = await prisma.tourAgency.findMany({
    where: { active: true },
    select: { id: true, crmSettings: true },
  });
  let breached = 0;
  for (const agency of agencies) {
    const settings = agency.crmSettings || await getSettings(agency.id);
    const cutoff = new Date(Date.now() - settings.firstResponseMinutes * 60 * 1000);
    const leads = await prisma.tourBooking.findMany({
      where: {
        agencyId: agency.id,
        archived: false,
        pipelineStage: { in: OPEN_STAGES },
        firstResponseAt: null,
        createdAt: { lte: cutoff },
      },
      select: { id: true, customerName: true, assignedMemberId: true, slaBreachedAt: true, slaReminderAt: true },
      take: 500,
    });
    for (const lead of leads) {
      const now = new Date();
      if (!lead.slaBreachedAt) {
        await prisma.tourBooking.update({ where: { id: lead.id }, data: { slaBreachedAt: now } });
        breached += 1;
      }
      if (settings.reminderEnabled && !lead.slaReminderAt) {
        await prisma.$transaction([
          prisma.crmTask.upsert({
            where: { agencyId_externalId: { agencyId: agency.id, externalId: `sla:${lead.id}` } },
            create: {
              agencyId: agency.id,
              bookingId: lead.id,
              assignedMemberId: lead.assignedMemberId,
              title: `SLA: ${lead.customerName} bilan zudlik bilan bog‘laning`,
              dueAt: now,
              externalId: `sla:${lead.id}`,
            },
            update: {},
          }),
          prisma.tourBooking.update({ where: { id: lead.id }, data: { slaReminderAt: now } }),
        ]);
      }
    }
  }
  return breached;
}

module.exports = { OPEN_STAGES, assignNextMember, getSettings, markFirstResponse, runSlaMonitor };
