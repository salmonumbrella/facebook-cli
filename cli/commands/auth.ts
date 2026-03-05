import { clearStoredAuth } from "../../src/lib/auth.js";
import { createProfileStore } from "../../src/lib/profiles.js";
import type { RuntimeContext } from "../lib/context.js";

export async function handleAuthCommand(args: string[], runtime: RuntimeContext): Promise<unknown> {
  const sub = args[0];
  switch (sub) {
    case "login":
      return {
        ok: true,
        message: "Use OAuth login flow via MCP auth tools or app-specific callback workflow.",
      };
    case "status":
      return {
        authenticated: Boolean(runtime.accessToken),
        profile: runtime.profileName,
        source: runtime.accessToken ? "cli/env/profile" : "none",
      };
    case "logout":
      {
        const store = createProfileStore(runtime.profilePath);
        const next = clearStoredAuth(store.load(), runtime.profileName);
        store.save(next);
      }
      return { ok: true, profile: runtime.profileName, loggedOut: true };
    case "refresh":
      return { ok: true, message: "Token refresh flow available via OAuth helper module." };
    default:
      throw new Error("Usage: fbcli auth <login|status|logout|refresh>");
  }
}
