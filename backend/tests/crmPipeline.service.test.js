const mockPrisma = {
  crmPipelineStage: { findMany: jest.fn(), createMany: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const { DEFAULT_PIPELINE_STAGES, ensurePipelineStages, stageTransitionData } = require('../src/services/crmPipeline.service');

beforeEach(() => jest.clearAllMocks());

test('yangi agentlik uchun standart Kanban ustunlarini yaratadi', async () => {
  mockPrisma.crmPipelineStage.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(DEFAULT_PIPELINE_STAGES.map((stage, index) => ({ ...stage, id: `s-${index}`, agencyId: 'agency-a' })));
  const stages = await ensurePipelineStages('agency-a');
  expect(mockPrisma.crmPipelineStage.createMany).toHaveBeenCalledWith(expect.objectContaining({
    skipDuplicates: true,
    data: expect.arrayContaining([expect.objectContaining({ agencyId: 'agency-a', key: 'new' }), expect.objectContaining({ agencyId: 'agency-a', key: 'lost' })]),
  }));
  expect(stages).toHaveLength(6);
  expect(stages[0]).toMatchObject({ key: 'new', label: 'Yangi', isSystem: true });
});

test('custom ustunga o‘tishda biznes statusini majburan o‘zgartirmaydi', () => {
  const data = stageTransitionData({ firstResponseAt: null, status: 'pending' }, { key: 'custom_contract', systemType: null });
  expect(data.pipelineStage).toBe('custom_contract');
  expect(data.firstResponseAt).toBeInstanceOf(Date);
  expect(data.status).toBe('pending');
});

test('tizimdagi yutilgan ustun semantikasini saqlaydi', () => {
  const data = stageTransitionData({ firstResponseAt: null, confirmedAt: null, status: 'pending' }, { key: 'won', systemType: 'won' });
  expect(data).toMatchObject({ pipelineStage: 'won', status: 'confirmed' });
  expect(data.firstResponseAt).toBeInstanceOf(Date);
  expect(data.confirmedAt).toBeInstanceOf(Date);
});
