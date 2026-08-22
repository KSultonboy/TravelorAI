function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell.trim()); cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function headerKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[ʻ’']/g, '')
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .trim();
}

const ALIASES = {
  customerName: ['name', 'full name', 'customer', 'customer name', 'mijoz', 'mijoz ismi', 'fio', 'фио', 'клиент', 'имя'],
  customerPhone: ['phone', 'phone number', 'telefon', 'telefon raqam', 'телефон', 'номер'],
  customerEmail: ['email', 'e mail', 'pochta', 'электронная почта'],
  leadTour: ['tour', 'tour name', 'tur', 'tur nomi', 'yo nalish', 'направление', 'тур'],
  leadCity: ['city', 'shahar', 'город'],
  travelers: ['travelers', 'people', 'kishilar', 'sayyohlar', 'количество туристов', 'туристов'],
  travelDate: ['travel date', 'date', 'sana', 'sayohat sanasi', 'дата поездки'],
  totalEstimate: ['amount', 'sum', 'summa', 'budget', 'стоимость', 'сумма'],
  currency: ['currency', 'valyuta', 'валюта'],
  pipelineStage: ['stage', 'status', 'bosqich', 'статус', 'этап'],
  message: ['message', 'note', 'izoh', 'комментарий', 'примечание'],
  leadTelegram: ['telegram', 'telegram username'],
  leadWhatsapp: ['whatsapp', 'whats app'],
  customerBirthday: ['birthday', 'tug ilgan kun', 'день рождения'],
  assignedEmail: ['manager', 'manager email', 'menejer', 'менеджер'],
};

function detectIndexes(headers, mapping = {}) {
  const normalized = headers.map(headerKey);
  const indexes = {};
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const chosen = mapping && mapping[field];
    let index = -1;
    if (Number.isInteger(chosen)) index = chosen;
    else if (chosen !== undefined && chosen !== null && String(chosen).trim()) index = normalized.indexOf(headerKey(chosen));
    if (index < 0) index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0 && index < headers.length) indexes[field] = index;
  }
  return indexes;
}

function inspectCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [], sample: [], suggestedMapping: {}, errors: ['CSV fayl bo‘sh'] };
  const indexes = detectIndexes(rows[0]);
  const suggestedMapping = Object.fromEntries(Object.entries(indexes).map(([field, index]) => [field, rows[0][index]]));
  return { headers: rows[0], sample: rows.slice(1, 11), suggestedMapping, errors: [] };
}

function mapCsv(text, mapping = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { rows: [], errors: ['CSV sarlavha va kamida bitta maʼlumot qatoriga ega bo‘lishi kerak'] };
  const indexes = detectIndexes(rows[0], mapping);
  if (indexes.customerName === undefined) return { rows: [], errors: ["CSV'da mijoz ismi ustuni topilmadi"] };

  const errors = [];
  const data = [];
  rows.slice(1, 2001).forEach((values, offset) => {
    const get = (field) => indexes[field] === undefined ? '' : String(values[indexes[field]] || '').trim();
    const customerName = get('customerName');
    if (!customerName) { errors.push(`${offset + 2}-qatorda mijoz ismi yo‘q`); return; }
    const travelers = Math.max(1, Math.min(99, parseInt(get('travelers'), 10) || 1));
    const amount = parseInt(get('totalEstimate').replace(/[^0-9]/g, ''), 10);
    const rawStage = get('pipelineStage').toLowerCase();
    const stageMap = { new: 'new', yangi: 'new', contacted: 'contacted', aloqa: 'contacted', quoted: 'quoted', taklif: 'quoted', won: 'won', yutildi: 'won', completed: 'completed', yakunlandi: 'completed', lost: 'lost', yoqotildi: 'lost' };
    const pipelineStage = stageMap[rawStage] || 'new';
    const rawDate = get('travelDate');
    const travelDate = rawDate && !Number.isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : null;
    const rawBirthday = get('customerBirthday');
    const customerBirthday = rawBirthday && !Number.isNaN(new Date(rawBirthday).getTime()) ? new Date(rawBirthday) : null;
    data.push({
      customerName: customerName.slice(0, 120),
      customerPhone: get('customerPhone').slice(0, 40) || null,
      customerEmail: get('customerEmail').toLowerCase().slice(0, 160) || null,
      leadTour: get('leadTour').slice(0, 200) || null,
      leadCity: get('leadCity').slice(0, 120) || null,
      travelers,
      travelDate,
      totalEstimate: Number.isFinite(amount) ? amount : null,
      currency: get('currency').toUpperCase().slice(0, 8) || 'USD',
      pipelineStage,
      message: get('message').slice(0, 1000) || null,
      leadTelegram: get('leadTelegram').slice(0, 120) || null,
      leadWhatsapp: get('leadWhatsapp').slice(0, 40) || null,
      customerBirthday,
      assignedEmail: get('assignedEmail').toLowerCase().slice(0, 160) || null,
    });
  });
  return { rows: data, errors };
}

module.exports = { ALIASES, inspectCsv, mapCsv, parseCsv };
