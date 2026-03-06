import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { resolveAccessToken } from "../config.js";
import { clearStoredAuth } from "../lib/auth.js";
import { createProfileStore } from "../lib/profiles.js";
import { json, type ToolServerLike } from "./shared.js";

function profilePath(input?: string): string {
  return input ?? join(homedir(), ".config", "facebook-cli", "profiles.json");
}

export function registerAuthTools(server: ToolServerLike): void {
  server.tool(
    "auth_status",
    "Check auth status from explicit token, env token, and profile token.",
    {
      access_token: z.string().optional(),
      profile: z.string().optional(),
      profile_path: z.string().optional(),
    },
    async ({ access_token, profile, profile_path }) => {
      const store = createProfileStore(
        profilePath(profile_path ? String(profile_path) : undefined),
      );
      const data = store.load();
      const profileName = profile ? String(profile) : (data.active ?? "default");
      const record = data.profiles[profileName] ?? {};
      const token = resolveAccessToken(
        access_token ? String(access_token) : undefined,
        process.env.FB_ACCESS_TOKEN,
        record.access_token,
      );
      return json({
        authenticated: Boolean(token),
        profile: profileName,
        source: token ? "override/env/profile" : "none",
      });
    },
  );

  server.tool(
    "auth_logout",
    "Clear the stored auth token for the selected profile.",
    { profile: z.string().optional(), profile_path: z.string().optional() },
    async ({ profile, profile_path }) => {
      const path = profilePath(profile_path ? String(profile_path) : undefined);
      const store = createProfileStore(path);
      const next = clearStoredAuth(store.load(), profile ? String(profile) : undefined);
      store.save(next);
      return json({ ok: true, profile: profile ? String(profile) : next.active });
    },
  );

  server.tool(
    "profile_switch",
    "Switch active profile.",
    { profile: z.string(), profile_path: z.string().optional() },
    async ({ profile, profile_path }) => {
      const path = profilePath(profile_path ? String(profile_path) : undefined);
      const store = createProfileStore(path);
      const data = store.load();
      const name = String(profile);
      if (!data.profiles[name]) {
        throw new Error(`Profile '${name}' not found`);
      }
      data.active = name;
      store.save(data);
      return json({ ok: true, active: name });
    },
  );

  server.tool(
    "profile_list",
    "List available profiles and active profile.",
    { profile_path: z.string().optional() },
    async ({ profile_path }) => {
      const store = createProfileStore(
        profilePath(profile_path ? String(profile_path) : undefined),
      );
      const data = store.load();
      return json({
        active: data.active,
        profiles: Object.keys(data.profiles).map((name) => ({
          name,
          active: name === data.active,
          hasAccessToken: Boolean(data.profiles[name]?.access_token),
        })),
      });
    },
  );
}
