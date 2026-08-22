const crypto = require('crypto');

function ascii(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[‘’ʼʻ]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\n]/g, '')
    .trim();
}

function escapePdf(value) {
  return ascii(value).replace(/([\\()])/g, '\\$1');
}

function wrap(value, width = 86) {
  const out = [];
  for (const paragraph of ascii(value).split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= width) line += ` ${word}`;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
    if (!words.length) out.push('');
  }
  return out;
}

function contentLines(document, content, requisite) {
  const rows = [
    `TRAVELORAI | ${document.type.toUpperCase()} ${document.number}`,
    document.title,
    '',
    `Mijoz: ${document.customerName || document.booking?.customerName || '-'}`,
    `Sana: ${new Date(document.issuedAt).toISOString().slice(0, 10)}`,
    `Summa: ${document.amount || 0} ${document.currency}`,
    document.dueAt ? `Tolov muddati: ${new Date(document.dueAt).toISOString().slice(0, 10)}` : '',
    '',
  ];
  const body = content?.body || content?.notes || document.notes || '';
  rows.push(...wrap(body || JSON.stringify(content || {})));
  if (requisite) {
    rows.push('', 'AGENTLIK REKVIZITLARI');
    for (const [label, value] of [
      ['Nomi', requisite.legalName], ['Direktor', requisite.director], ['STIR', requisite.stir],
      ['Manzil', requisite.address], ['Bank', requisite.bankName], ['Hisob', requisite.account], ['MFO', requisite.mfo],
    ]) if (value) rows.push(`${label}: ${value}`);
  }
  rows.push('', `Versiya: ${document.currentVersion}`, `Arxiv sanasi: ${new Date(document.updatedAt || document.issuedAt).toISOString()}`);
  return rows.flatMap((line) => wrap(line)).slice(0, 62);
}

function makePdf(document, content, requisite) {
  const lines = contentLines(document, content, requisite);
  const commands = ['BT', '/F1 10 Tf', '50 790 Td', '14 TL'];
  lines.forEach((line, index) => {
    if (index) commands.push('T*');
    commands.push(`(${escapePdf(line)}) Tj`);
  });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const data = Buffer.from(pdf, 'binary');
  return { data, sha256: crypto.createHash('sha256').update(data).digest('hex') };
}

module.exports = { makePdf, ascii, wrap };
