// Client-side CSV export helpers.

export type CsvValue = string | number | boolean | null | undefined;
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(",")).join("\n");
  return body ? `${header}\n${body}` : header;
}

function timestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadCsv(filename: string, content: string) {
  // Prepend BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(["﻿", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Build a CSV from typed columns + rows and trigger a download. */
export function exportCsv<T>(name: string, columns: CsvColumn<T>[], rows: T[]) {
  downloadCsv(`${name}_${timestamp()}.csv`, rowsToCsv(columns, rows));
}
