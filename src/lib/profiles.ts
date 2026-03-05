import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface ProfileStoreData {
  active: string;
  profiles: Record<string, { access_token?: string; defaults?: Record<string, string> }>;
}

export function createProfileStore(filePath: string) {
  const load = (): ProfileStoreData => {
    if (!existsSync(filePath)) {
      return { active: "default", profiles: { default: {} } };
    }
    return JSON.parse(readFileSync(filePath, "utf8"));
  };

  const save = (data: ProfileStoreData) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  };

  return { load, save };
}
