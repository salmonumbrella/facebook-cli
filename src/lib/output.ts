import Table from "cli-table3";
import { stringify } from "csv-stringify/sync";

export type OutputFormat = "json" | "table" | "csv";

export function formatRows(rows: Record<string, unknown>[], format: OutputFormat): string {
  if (format === "json") return JSON.stringify(rows, null, 2);
  if (format === "csv") return stringify(rows, { header: true });

  const keys = Object.keys(rows[0] || {});
  const table = new Table({ head: keys });
  for (const row of rows) table.push(keys.map((key) => String(row[key] ?? "")));
  return table.toString();
}
