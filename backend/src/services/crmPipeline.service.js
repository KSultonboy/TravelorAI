const crypto = require('crypto');
const { prisma } = require('../config/database');

const DEFAULT_PIPELINE_STAGES = [
  { key: 'new', name: 'Yangi', hint: "Endi kelgan, hali bog'lanilmagan", color: '#2563EB', position: 10, systemType: 'new', isSystem: true },
  { key: 'contacted', name: "Bog'lanildi", hint: 'Mijoz bilan aloqaga chiqildi', color: '#0891B2', position: 20, systemType: 'contacted', isSystem: true },
  { key: 'quoted', name: 'Taklif berildi', hint: 'Narx yoki paket taklifi yuborildi', color: '#CA8A04', position: 30, systemType: 'quoted', isSystem: true },
  { key: 'won', name: 'Kelishildi', hint: 'Mijoz rozi, bandlov tasdiqlandi', color: '#16A34A', position: 40, systemType: 'won', isSystem: true },
  { key: 'completed', name: 'Yakunlandi', hint: "Sayohat bo'lib o'tdi", color: '#0F766E', position: 50, systemType: 'completed', isSystem: true },
  { key: 'lost', name: "Yo'qotilgan", hint: 'Rad etildi yoki bekor bo‘ldi', color: '#DC2626', position: 60, systemType: 'lost', isSystem: true },
];

function stageDto(stage) {
  return {
    id: stage.id,
    key: stage.key,
    name: stage.name,
    label: stage.name,
    hint: stage.hint || '',
    color: stage.color,
    position: stage.position,
    systemType: stage.systemType || null,
    isSystem: !!stage.isSystem,
  };
}

async function ensurePipelineStages(agencyId, db = prisma) {
  let stages = await db.crmPipelineStage.findMany({ where: { agencyId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  if (stages.length) return stages.map(stageDto);
  await db.crmPipelineStage.createMany({ data: DEFAULT_PIPELINE_STAGES.map((stage) => ({ agencyId, ...stage })), skipDuplicates: true });
  stages = await db.crmPipelineStage.findMany({ where: { agencyId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  return stages.map(stageDto);
}

async function findPipelineStage(agencyId, key, db = prisma) {
  return db.crmPipelineStage.findUnique({ where: { agencyId_key: { agencyId, key: String(key || '') } } });
}

function customStageKey() {
  return `custom_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function stageTransitionData(current, stage) {
  const semantic = stage.systemType || stage.key;
  const now = new Date();
  const data = { pipelineStage: stage.key };
  if (semantic !== 'new' && !current.firstResponseAt) data.firstResponseAt = now;
  if (semantic === 'won') { data.status = 'confirmed'; if (!current.confirmedAt) data.confirmedAt = now; }
  else if (semantic === 'completed') { data.status = 'completed'; if (!current.confirmedAt) data.confirmedAt = now; data.completedAt = now; }
  else if (semantic === 'lost') { data.status = 'rejected'; data.rejectedAt = now; }
  else { data.status = 'pending'; data.rejectedAt = null; }
  return data;
}

module.exports = { DEFAULT_PIPELINE_STAGES, customStageKey, ensurePipelineStages, findPipelineStage, stageDto, stageTransitionData };
