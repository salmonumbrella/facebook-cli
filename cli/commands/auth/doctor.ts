import type { RuntimeContext } from "../../lib/context.js";
import { buildAppAccessToken, debugToken, type DebugTokenInput } from "../../../src/lib/auth.js";
import { createProfileStore } from "../../../src/lib/profiles.js";
import { getCliEnvVar } from "../../lib/env.js";
import {
  defaultScopes,
  normalizeScopes,
  resolveAuthVersion,
  tokenPreview,
  validateLocalRedirectUri,
} from "./shared.js";

interface DoctorOptions {
  offline: boolean;
  scopes: string[];
}

interface DoctorCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  details: string;
}

export interface DoctorDeps {
  debugToken: (input: DebugTokenInput) => Promise<any>;
}

export function defaultDoctorDeps(): DoctorDeps {
  return { debugToken };
}

function parseDoctorOptions(args: string[]): DoctorOptions {
  const out: DoctorOptions = {
    offline: false,
    scopes: defaultScopes(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--offline") {
      out.offline = true;
      continue;
    }
    if (arg === "--scopes") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --scopes");
      out.scopes = normalizeScopes(value.split(","));
      i += 1;
      continue;
    }
    if (arg === "--scope") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --scope");
      out.scopes = normalizeScopes([...out.scopes, value]);
      i += 1;
      continue;
    }
    throw new Error(`Unknown auth doctor option: ${arg}`);
  }

  return out;
}

export async function runAuthDoctor(
  args: string[],
  runtime: RuntimeContext,
  deps: DoctorDeps = defaultDoctorDeps(),
): Promise<unknown> {
  const options = parseDoctorOptions(args);
  const checks: DoctorCheck[] = [];
  const redirectUri = getCliEnvVar("FB_OAUTH_REDIRECT_URI") ?? "http://localhost:8484/callback";
  const appId = getCliEnvVar("FB_APP_ID");
  const appSecret = getCliEnvVar("FB_APP_SECRET");
  const accessToken = runtime.accessToken;
  const version = resolveAuthVersion(runtime);

  const store = createProfileStore(runtime.profilePath);
  const data = store.load();
  const profile = data.profiles[runtime.profileName] ?? {};

  checks.push({
    name: "profile_store",
    status: "pass",
    details: `using ${runtime.profilePath} (active: ${runtime.profileName})`,
  });

  checks.push({
    name: "app_id",
    status: appId ? "pass" : "fail",
    details: appId ? "FB_APP_ID is set" : "FB_APP_ID is missing",
  });

  checks.push({
    name: "app_secret",
    status: appSecret ? "pass" : "fail",
    details: appSecret ? "FB_APP_SECRET is set" : "FB_APP_SECRET is missing",
  });

  const redirectValidation = validateLocalRedirectUri(redirectUri);
  checks.push({
    name: "oauth_redirect_uri",
    status: redirectValidation.ok ? "pass" : "fail",
    details: redirectValidation.ok
      ? `configured redirect: ${redirectValidation.normalized ?? redirectUri}`
      : (redirectValidation.error ?? "invalid redirect URI"),
  });

  checks.push({
    name: "access_token",
    status: accessToken ? "pass" : "fail",
    details: accessToken
      ? `token available (${tokenPreview(accessToken)})`
      : "no token resolved from cli/env/profile",
  });

  if (accessToken) {
    if (options.offline) {
      checks.push({
        name: "token_debug",
        status: "warn",
        details: "skipped token introspection because --offline was set",
      });
    } else if (!appId || !appSecret) {
      checks.push({
        name: "token_debug",
        status: "warn",
        details: "cannot debug token without FB_APP_ID and FB_APP_SECRET",
      });
    } else {
      try {
        const debug = await deps.debugToken({
          inputToken: accessToken,
          appAccessToken: buildAppAccessToken(appId, appSecret),
          version,
        });
        const debugData = debug?.data;
        const isValid = Boolean(debugData?.is_valid);
        checks.push({
          name: "token_valid",
          status: isValid ? "pass" : "fail",
          details: isValid ? "token is valid" : "token is invalid",
        });

        const grantedScopes = Array.isArray(debugData?.scopes)
          ? debugData.scopes.filter((scope: unknown) => typeof scope === "string")
          : [];
        const missingScopes = options.scopes.filter((scope) => !grantedScopes.includes(scope));
        checks.push({
          name: "token_scopes",
          status: missingScopes.length === 0 ? "pass" : "fail",
          details:
            missingScopes.length === 0
              ? "all required scopes are present"
              : `missing scopes: ${missingScopes.join(", ")}`,
        });

        if (typeof debugData?.expires_at === "number") {
          checks.push({
            name: "token_expiry",
            status: "pass",
            details: `expires_at: ${new Date(debugData.expires_at * 1000).toISOString()}`,
          });
        }
      } catch (error) {
        checks.push({
          name: "token_debug",
          status: "fail",
          details: `debug_token failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  }

  const failures = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warn");
  const nextSteps: string[] = [];

  if (failures.some((check) => check.name === "app_id" || check.name === "app_secret")) {
    nextSteps.push("Set FB_APP_ID and FB_APP_SECRET in your environment or .env");
  }
  if (failures.some((check) => check.name === "access_token")) {
    nextSteps.push("Run `fbcli auth login` to store a token in your active profile");
  }
  if (failures.some((check) => check.name === "oauth_redirect_uri")) {
    nextSteps.push("Set FB_OAUTH_REDIRECT_URI to a valid local http:// callback URL");
  }
  if (failures.some((check) => check.name === "token_scopes")) {
    nextSteps.push("Re-run `fbcli auth login --scopes ...` with required permissions");
  }
  if (warnings.some((check) => check.name === "token_debug")) {
    nextSteps.push("Run `fbcli auth doctor` without --offline to verify token with Facebook");
  }

  return {
    ok: failures.length === 0,
    profile: runtime.profileName,
    tokenSource: accessToken ? "cli/env/profile" : "none",
    resolvedToken: accessToken ? tokenPreview(accessToken) : undefined,
    requiredScopes: options.scopes,
    storedAuth: profile.auth ?? null,
    checks,
    summary: {
      pass: checks.filter((check) => check.status === "pass").length,
      warn: warnings.length,
      fail: failures.length,
    },
    nextSteps,
  };
}
