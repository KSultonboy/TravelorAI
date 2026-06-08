function normalizeCity(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function cityKey(value) {
  return normalizeCity(value)
    .toLowerCase()
    .replace(/['`ʻʼ’]/g, '')
    .replace(/\b(shahri|city|region|viloyati|viloyat)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameCity(left, right) {
  const a = cityKey(left);
  const b = cityKey(right);
  return Boolean(a && b && a === b);
}

module.exports = { normalizeCity, cityKey, sameCity };
