export type CsvColumn<T = any> = { label: string; get: (row: T) => unknown };

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Excel o‘zbek harflarini to‘g‘ri ochishi uchun UTF-8 BOM bilan CSV yaratadi. */
export function serializeCsv<T>(columns: CsvColumn<T>[], rows: T[]) {
  const lines = [columns.map((column) => escapeCsv(column.label)).join(",")];
  for (const row of rows) lines.push(columns.map((column) => escapeCsv(column.get(row))).join(","));
  return "\uFEFF" + lines.join("\r\n");
}
