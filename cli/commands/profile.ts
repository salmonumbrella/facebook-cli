import { createProfileStore } from "../../src/lib/profiles.js";
import type { RuntimeContext } from "../lib/context.js";

function usage(): never {
  throw new Error("Usage: fbcli profile <add|switch|show|remove|list> ...");
}

export async function handleProfileCommand(args: string[], runtime: RuntimeContext): Promise<unknown> {
  const sub = args[0];
  const store = createProfileStore(runtime.profilePath);
  const data = store.load();

  switch (sub) {
    case "add": {
      const name = args[1];
      if (!name) usage();
      const tokenIdx = args.indexOf("--access-token");
      const token = tokenIdx !== -1 && args[tokenIdx + 1] ? args[tokenIdx + 1] : undefined;
      data.profiles[name] = {
        ...(data.profiles[name] ?? {}),
        ...(token ? { access_token: token } : {}),
      };
      if (!data.active) data.active = name;
      store.save(data);
      return { ok: true, added: name };
    }
    case "switch": {
      const name = args[1];
      if (!name) usage();
      if (!data.profiles[name]) throw new Error(`Profile '${name}' not found`);
      data.active = name;
      store.save(data);
      return { ok: true, active: name };
    }
    case "show": {
      const name = args[1] ?? data.active;
      const profile = data.profiles[name];
      if (!profile) throw new Error(`Profile '${name}' not found`);
      return {
        active: data.active,
        profile: name,
        hasAccessToken: Boolean(profile.access_token),
        defaults: profile.defaults ?? {},
      };
    }
    case "remove": {
      const name = args[1];
      if (!name) usage();
      delete data.profiles[name];
      if (data.active === name) data.active = Object.keys(data.profiles)[0] ?? "default";
      if (!data.profiles[data.active]) data.profiles[data.active] = {};
      store.save(data);
      return { ok: true, removed: name, active: data.active };
    }
    case "list":
      return {
        active: data.active,
        profiles: Object.keys(data.profiles).map((name) => ({
          name,
          active: name === data.active,
          hasAccessToken: Boolean(data.profiles[name]?.access_token),
        })),
      };
    default:
      usage();
  }
}
