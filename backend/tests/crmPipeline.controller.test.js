const tx = {
  tourBooking: { update: jest.fn() },
  leadActivity: { createMany: jest.fn() },
  crmPipelineStage: { delete: jest.fn() },
};
const mockPrisma = {
  crmPipelineStage: { findFirst: jest.fn(), findMany: jest.fn(), createMany: jest.fn() },
  tourBooking: { findMany: jest.fn() },
  $transaction: jest.fn(async (work) => (typeof work === 'function' ? work(tx) : Promise.all(work))),
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const { deletePipelineStage } = require('../src/controllers/agencyCrm.controller');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

beforeEach(() => jest.clearAllMocks());

test('asosiy Kanban ustunini o‘chirishni bloklaydi', async () => {
  mockPrisma.crmPipelineStage.findFirst.mockResolvedValue({ id: 'new-id', agencyId: 'agency-a', key: 'new', name: 'Yangi', isSystem: true });
  const res = response();
  await deletePipelineStage({ agency: { id: 'agency-a' }, agencyAccount: { id: 'owner' }, params: { id: 'new-id' }, body: { targetStageId: 'contacted-id' } }, res);
  expect(res.statusCode).toBe(400);
  expect(mockPrisma.$transaction).not.toHaveBeenCalled();
});

test('custom ustundagi lidlarni tanlangan ustunga atomik ko‘chiradi', async () => {
  mockPrisma.crmPipelineStage.findFirst
    .mockResolvedValueOnce({ id: 'custom-id', agencyId: 'agency-a', key: 'custom_contract', name: 'Shartnoma', isSystem: false })
    .mockResolvedValueOnce({ id: 'quoted-id', agencyId: 'agency-a', key: 'quoted', name: 'Taklif berildi', isSystem: true });
  mockPrisma.tourBooking.findMany.mockResolvedValue([{ id: 'lead-1' }, { id: 'lead-2' }]);
  mockPrisma.crmPipelineStage.findMany.mockResolvedValue([{ id: 'quoted-id', agencyId: 'agency-a', key: 'quoted', name: 'Taklif berildi', color: '#CA8A04', position: 10, isSystem: true }]);
  const res = response();
  await deletePipelineStage({ agency: { id: 'agency-a' }, agencyAccount: { id: 'owner' }, params: { id: 'custom-id' }, body: { targetStageId: 'quoted-id' } }, res);
  expect(tx.tourBooking.update).toHaveBeenCalledWith({ where: { id: 'lead-1' }, data: expect.objectContaining({ pipelineStage: 'quoted', status: 'pending' }) });
  expect(tx.leadActivity.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ bookingId: 'lead-1', type: 'stage' })]) });
  expect(tx.crmPipelineStage.delete).toHaveBeenCalledWith({ where: { id: 'custom-id' } });
  expect(res.body).toMatchObject({ success: true, data: { deleted: true, movedLeads: 2 } });
});
