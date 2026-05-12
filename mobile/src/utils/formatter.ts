export function formatSum(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
}

export function formatUSD(amount: number): string {
  return '$' + (amount / 12700).toFixed(0);
}

export function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} daqiqa`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} soat ${m} daqiqa` : `${h} soat`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
}
