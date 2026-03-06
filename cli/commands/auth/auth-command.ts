import { clearStoredAuth } from "../../../src/lib/auth.js";
import { createProfileStore } from "../../../src/lib/profiles.js";
import type { RuntimeContext } from "../../lib/context.js";
import { runAuthDoctor, defaultDoctorDeps, type DoctorDeps } from "./doctor.js";
import {
  defaultOAuthFlowDeps,
  runAuthLogin,
  runAuthRefresh,
  type OAuthFlowDeps,
} from "./oauth-flow.js";
import { tokenPreview } from "./shared.js";

export interface AuthCommandDeps {
  oauth?: Partial<OAuthFlowDeps>;
  doctor?: Partial<DoctorDeps>;
}

function resolveOAuthDeps(overrides?: Partial<OAuthFlowDeps>): OAuthFlowDeps {
  return {
    ...defaultOAuthFlowDeps(),
    ...overrides,
  };
}

function resolveDoctorDeps(overrides?: Partial<DoctorDeps>): DoctorDeps {
  return {
    ...defaultDoctorDeps(),
    ...overrides,
  };
}

export async function handleAuthCommand(
  args: string[],
  runtime: RuntimeContext,
  deps: AuthCommandDeps = {},
): Promise<unknown> {
  const sub = args[0];
  const rest = args.slice(1);
  const oauthDeps = resolveOAuthDeps(deps.oauth);
  const doctorDeps = resolveDoctorDeps(deps.doctor);

  switch (sub) {
    case "login":
      return runAuthLogin(rest, runtime, oauthDeps);

    case "status": {
      const store = createProfileStore(runtime.profilePath);
      const data = store.load();
      const profile = data.profiles[runtime.profileName] ?? {};
      return {
        authenticated: Boolean(runtime.accessToken),
        profile: runtime.profileName,
        source: runtime.accessToken ? "cli/env/profile" : "none",
        token: tokenPreview(runtime.accessToken),
        auth: profile.auth ?? null,
      };
    }

    case "logout": {
      const store = createProfileStore(runtime.profilePath);
      const next = clearStoredAuth(store.load(), runtime.profileName);
      store.save(next);
      return { ok: true, profile: runtime.profileName, loggedOut: true };
    }

    case "refresh":
      return runAuthRefresh(runtime, oauthDeps);

    case "doctor":
      return runAuthDoctor(rest, runtime, doctorDeps);

    default:
      throw new Error(
        "Usage: fbcli auth <login|status|logout|refresh|doctor> [--scopes ...] [--redirect-uri ...]",
      );
  }
}
