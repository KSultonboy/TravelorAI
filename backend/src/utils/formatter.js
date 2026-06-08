const USD_RATE = 12700;

function formatSum(amount) {
  return amount.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' so\'m';
}

function formatUSD(amount) {
  return '$' + (amount / USD_RATE).toFixed(2);
}

function formatPercent(value) {
  return value.toFixed(1) + '%';
}

function formatDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} soat`;
  return `${h} soat ${m} daqiqa`;
}

module.exports = { formatSum, formatUSD, formatPercent, formatDuration };
