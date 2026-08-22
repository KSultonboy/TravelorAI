const crypto = require('crypto');

const ALIASES = {
  date: ['date', 'transaction date', 'operation date', 'payment date', 'sana', 'operatsiya sanasi', 'дата', 'дата операции', 'дата платежа'],
  amount: ['amount', 'sum', 'total', 'summa', 'сумма', 'сумма операции'],
  debit: ['debit', 'withdrawal', 'outflow', 'chiqim', 'расход', 'дебет', 'списание'],
  credit: ['credit', 'deposit', 'inflow', 'kirim', 'приход', 'кредит', 'зачисление'],
  direction: ['direction', 'type', 'operation type', 'tur', 'turi', 'тип', 'вид операции'],
  currency: ['currency', 'ccy', 'valyuta', 'валюта'],
  counterparty: ['counterparty', 'beneficiary', 'payer', 'recipient', 'kontragent', 'контрагент', 'плательщик', 'получатель'],
  description: ['description', 'details', 'purpose', 'note', 'izoh', 'назначение', 'описание', 'комментарий'],
  externalId: ['id', 'transaction id', 'reference', 'document number', 'operation id', 'raqam', 'номер документа', 'референс'],
};

function headerKey(value) {
  return String(value || '').toLowerCase().replace(/[ʻ’']/g, '').replace(/[^a-zа-яё0-9]+/gi, ' ').trim();
}

function detectDelimiter(text) {
  const firstLine = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  const candidates = [',', ';', '\t'];
  const counts = candidates.map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length - 1 }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delimiter : ',';
}

function parseDelimited(text, delimiter = detectDelimiter(text)) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
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

function detectIndexes(headers, mapping = {}) {
  const normalized = headers.map(headerKey); const indexes = {};
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const chosen = mapping?.[field]; let index = -1;
    if (Number.isInteger(chosen)) index = chosen;
    else if (chosen !== undefined && chosen !== null && String(chosen).trim()) index = normalized.indexOf(headerKey(chosen));
    if (index < 0) index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0 && index < headers.length) indexes[field] = index;
  }
  return indexes;
}

function inspectBankStatement(text) {
  const delimiter = detectDelimiter(text); const rows = parseDelimited(text, delimiter);
  if (!rows.length) return { headers: [], sample: [], suggestedMapping: {}, delimiter, errors: ['CSV fayl bo‘sh'] };
  const indexes = detectIndexes(rows[0]);
  const suggestedMapping = Object.fromEntries(Object.entries(indexes).map(([field, index]) => [field, rows[0][index]]));
  return { headers: rows[0], sample: rows.slice(1, 8), suggestedMapping, delimiter, errors: [] };
}

function parseAmount(value) {
  let source = String(value ?? '').trim();
  if (!source) return null;
  const negative = /^-/.test(source) || /^\(.*\)$/.test(source);
  source = source.replace(/[()\s\u00a0']/g, '').replace(/[^0-9.,-]/g, '').replace(/-/g, '');
  const comma = source.lastIndexOf(','); const dot = source.lastIndexOf('.'); const decimalAt = Math.max(comma, dot);
  if (decimalAt >= 0 && source.length - decimalAt - 1 <= 2) {
    source = `${source.slice(0, decimalAt).replace(/[.,]/g, '')}.${source.slice(decimalAt + 1)}`;
  } else source = source.replace(/[.,]/g, '');
  const amount = Number(source);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return Math.round(Math.abs(amount)) * (negative ? -1 : 1);
}

function parseDate(value) {
  const source = String(value || '').trim();
  if (!source) return null;
  let match = source.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+.*)?$/);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)) return date;
    return null;
  }
  match = source.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)) return date;
    return null;
  }
  return null;
}

function directionFrom(value, signedAmount) {
  const source = headerKey(value);
  if (['expense', 'debit', 'out', 'withdrawal', 'chiqim', 'расход', 'дебет', 'списание'].includes(source)) return 'expense';
  if (['income', 'credit', 'in', 'deposit', 'kirim', 'приход', 'кредит', 'зачисление'].includes(source)) return 'income';
  return signedAmount < 0 ? 'expense' : 'income';
}

function fingerprint(row) {
  return crypto.createHash('sha256').update([
    row.transactionDate.toISOString().slice(0, 10), row.direction, row.amount, row.currency,
    headerKey(row.externalId), headerKey(row.counterparty), headerKey(row.description),
  ].join('|')).digest('hex');
}

function mapBankStatement(text, mapping = {}, defaultCurrency = 'UZS') {
  const delimiter = detectDelimiter(text); const rows = parseDelimited(text, delimiter);
  if (rows.length < 2) return { headers: rows[0] || [], rows: [], errors: ['CSV sarlavha va maʼlumot qatoriga ega bo‘lishi kerak'] };
  const headers = rows[0]; const indexes = detectIndexes(headers, mapping);
  if (indexes.date === undefined) return { headers, rows: [], errors: ['Sana ustunini tanlang'] };
  if (indexes.amount === undefined && indexes.debit === undefined && indexes.credit === undefined) return { headers, rows: [], errors: ['Summa yoki Kirim/Chiqim ustunlarini tanlang'] };
  const errors = []; const data = [];
  rows.slice(1, 5001).forEach((values, offset) => {
    const get = (field) => indexes[field] === undefined ? '' : String(values[indexes[field]] || '').trim();
    const transactionDate = parseDate(get('date'));
    if (!transactionDate) { errors.push(`${offset + 2}-qatorda sana noto‘g‘ri`); return; }
    const debit = parseAmount(get('debit')); const credit = parseAmount(get('credit')); const single = parseAmount(get('amount'));
    let direction; let amount;
    if (credit && Math.abs(credit) > 0) { direction = 'income'; amount = Math.abs(credit); }
    else if (debit && Math.abs(debit) > 0) { direction = 'expense'; amount = Math.abs(debit); }
    else if (single) { direction = directionFrom(get('direction'), single); amount = Math.abs(single); }
    if (!amount) { errors.push(`${offset + 2}-qatorda summa yo‘q`); return; }
    const currency = String(get('currency') || defaultCurrency || 'UZS').trim().toUpperCase().slice(0, 3);
    const raw = Object.fromEntries(headers.map((header, index) => [String(header || `column_${index + 1}`).slice(0, 120), String(values[index] || '').slice(0, 1000)]));
    const parsed = {
      rowNumber: offset + 2, transactionDate, direction, amount, currency: /^[A-Z]{3}$/.test(currency) ? currency : 'UZS',
      counterparty: get('counterparty').slice(0, 200) || null, description: get('description').slice(0, 1000) || null,
      externalId: get('externalId').slice(0, 160) || null, raw,
    };
    data.push({ ...parsed, fingerprint: fingerprint(parsed) });
  });
  return { headers, rows: data, errors: errors.slice(0, 100) };
}

function tokens(value) {
  return new Set(headerKey(value).split(' ').filter((token) => token.length > 2 && !['uchun', 'bilan', 'payment', 'tolov', 'операция'].includes(token)));
}

function dateDistanceDays(a, b) { return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000; }

function findBestMatch(row, transactions = []) {
  let best = null;
  for (const transaction of transactions) {
    if (transaction.status === 'cancelled' || transaction.amount !== row.amount || transaction.currency !== row.currency || transaction.direction !== row.direction) continue;
    let score = 70;
    const transactionDate = transaction.paidAt || transaction.dueAt || transaction.createdAt;
    const distance = dateDistanceDays(row.transactionDate, transactionDate);
    if (distance <= 0.6) score += 20; else if (distance <= 1.5) score += 16; else if (distance <= 3.5) score += 10; else if (distance <= 7.5) score += 5;
    const a = tokens(`${row.counterparty || ''} ${row.description || ''}`); const b = tokens(`${transaction.counterparty || ''} ${transaction.note || ''}`);
    const overlap = [...a].filter((token) => b.has(token)).length;
    score += Math.min(10, overlap * 5);
    if (!best || score > best.score) best = { transaction, score: Math.min(100, score) };
  }
  return best && best.score >= 80 ? best : null;
}

module.exports = { ALIASES, detectDelimiter, findBestMatch, inspectBankStatement, mapBankStatement, parseAmount, parseDate, parseDelimited };
