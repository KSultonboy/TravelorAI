const mockPrisma = {
  tourBooking: { findFirst: jest.fn(), update: jest.fn() },
  agencyMember: { findFirst: jest.fn(), findMany: jest.fn() },
  leadActivity: { create: jest.fn(), findMany: jest.fn() },
  crmTask: { findMany: jest.fn() },
  leadTag: { findMany: jest.fn() },
  documentTemplate: { findMany: jest.fn() },
  agencyRequisite: { findUnique: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const { assignLead, bootstrap } = require('../src/controllers/agencyCrm.controller');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

beforeEach(() => jest.clearAllMocks());

test('boshqa agentlik xodimini lidga biriktirishni bloklaydi', async () => {
  mockPrisma.tourBooking.findFirst.mockResolvedValue({ id: 'lead-a', agencyId: 'agency-a' });
  mockPrisma.agencyMember.findFirst.mockResolvedValue(null);
  const req = {
    agency: { id: 'agency-a' }, agencyAccount: { id: 'account-a' },
    params: { id: 'lead-a' }, body: { memberId: 'member-from-agency-b' },
  };
  const res = response();
  await assignLead(req, res);
  expect(mockPrisma.agencyMember.findFirst).toHaveBeenCalledWith({ where: { id: 'member-from-agency-b', agencyId: 'agency-a', status: 'active' } });
  expect(mockPrisma.tourBooking.update).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(404);
});

test('shu agentlik xodimini biriktiradi va faoliyatga yozadi', async () => {
  mockPrisma.tourBooking.findFirst.mockResolvedValue({ id: 'lead-a', agencyId: 'agency-a' });
  mockPrisma.agencyMember.findFirst.mockResolvedValue({ id: 'member-a', name: 'Menejer Ali' });
  mockPrisma.tourBooking.update.mockResolvedValue({ id: 'lead-a', assignedMemberId: 'member-a' });
  mockPrisma.leadActivity.create.mockResolvedValue({ id: 'activity-a' });
  const req = {
    agency: { id: 'agency-a' }, agencyAccount: { id: 'account-a' },
    params: { id: 'lead-a' }, body: { memberId: 'member-a' },
  };
  const res = response();
  await assignLead(req, res);
  expect(mockPrisma.tourBooking.update).toHaveBeenCalledWith({ where: { id: 'lead-a' }, data: { assignedMemberId: 'member-a' } });
  expect(mockPrisma.leadActivity.create).toHaveBeenCalled();
  expect(res.body.success).toBe(true);
});

test('egasi va boshqa xodim bir agentlikning bir xil server CRM maʼlumotini ko‘radi', async () => {
  mockPrisma.crmTask.findMany.mockResolvedValue([{ id: 'task-1', title: 'Qo‘ng‘iroq', bookingId: null, completedAt: null, createdAt: new Date(), booking: null, assignedMember: null }]);
  mockPrisma.leadTag.findMany.mockResolvedValue([{ id: 'tag-1', bookingId: 'lead-a', name: 'VIP' }]);
  mockPrisma.leadActivity.findMany.mockResolvedValue([]);
  mockPrisma.documentTemplate.findMany.mockResolvedValue([]);
  mockPrisma.agencyRequisite.findUnique.mockResolvedValue(null);
  mockPrisma.agencyMember.findMany.mockResolvedValue([]);
  const ownerRes = response(); const employeeRes = response();
  await bootstrap({ agency: { id: 'agency-a' }, agencyAccount: { id: 'owner-account' } }, ownerRes);
  await bootstrap({ agency: { id: 'agency-a' }, agencyAccount: { id: 'employee-account' } }, employeeRes);
  expect(ownerRes.body.data).toEqual(employeeRes.body.data);
  expect(mockPrisma.crmTask.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { agencyId: 'agency-a' } }));
  expect(mockPrisma.crmTask.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { agencyId: 'agency-a' } }));
});
