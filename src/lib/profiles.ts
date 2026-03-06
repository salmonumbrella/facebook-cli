import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

const profileAuthSchema = z.object({
  provider: z.literal("facebook_oauth").optional(),
  obtained_at: z.string().optional(),
  expires_at: z.string().optional(),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  user_id: z.string().optional(),
  app_id: z.string().optional(),
  is_valid: z.boolean().optional(),
});

const profileDataSchema = z.object({
  access_token: z.string().optional(),
  defaults: z.record(z.string(), z.string()).optional(),
  auth: profileAuthSchema.optional(),
});

const profileStoreSchema = z.object({
  active: z.string().min(1),
  profiles: z.record(z.string(), profileDataSchema),
});

export type ProfileAuthData = z.infer<typeof profileAuthSchema>;
export type ProfileData = z.infer<typeof profileDataSchema>;
export type ProfileStoreData = z.infer<typeof profileStoreSchema>;

function defaultProfileStore(): ProfileStoreData {
  return { active: "default", profiles: { default: {} } };
}

function parseProfileStore(raw: unknown, filePath: string): ProfileStoreData {
  const parsed = profileStoreSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "profile store";
    throw new Error(
      `Profile store '${filePath}' has invalid shape at '${path}': ${issue?.message ?? "invalid value"}`,
    );
  }

  const data = parsed.data;
  if (!data.profiles[data.active]) {
    return {
      active: data.active,
      profiles: {
        ...data.profiles,
        [data.active]: {},
      },
    };
  }

  return data;
}

export function createProfileStore(filePath: string) {
  const load = (): ProfileStoreData => {
    if (!existsSync(filePath)) {
      return defaultProfileStore();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      throw new Error(`Profile store '${filePath}' is not valid JSON`);
    }

    return parseProfileStore(parsed, filePath);
  };

  const save = (data: ProfileStoreData) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  };

  return { load, save };
}
