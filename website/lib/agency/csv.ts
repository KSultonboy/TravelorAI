export type CsvColumn<T = any> = { label: string; get: (row: T) => unknown };

// Excel/Sheets "=", "+", "-", "@", TAB yoki CR bilan boshlangan katakni formula
// deb bajaradi (CSV formula injection). Bunday qiymat oldiga apostrof qo'yamiz.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCsv(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  // Oddiy manfiy son (-1500, -12.5) formula emas — uni buzmaymiz.
  const plainNumber = typeof value === "number" || /^-?\d+([.,]\d+)?$/.test(raw);
  const text = !plainNumber && FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Excel o‘zbek harflarini to‘g‘ri ochishi uchun UTF-8 BOM bilan CSV yaratadi. */
export function serializeCsv<T>(columns: CsvColumn<T>[], rows: T[]) {
  const lines = [columns.map((column) => escapeCsv(column.label)).join(",")];
  for (const row of rows) lines.push(columns.map((column) => escapeCsv(column.get(row))).join(","));
  return "﻿" + lines.join("\r\n");
}
