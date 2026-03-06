import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CLI_ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));

export function parseCliEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function readCliEnv(): Record<string, string> {
  if (!existsSync(CLI_ENV_PATH)) return {};
  return parseCliEnv(readFileSync(CLI_ENV_PATH, "utf8"));
}

export function getCliEnvVar(name: string): string | undefined {
  return process.env[name] ?? readCliEnv()[name];
}
