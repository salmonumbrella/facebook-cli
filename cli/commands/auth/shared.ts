import type { RuntimeContext } from "../../lib/context.js";
import { DEFAULT_GRAPH_API_VERSION } from "../../../src/config.js";
import { redactToken } from "../../../src/lib/redact.js";
import { getCliEnvVar } from "../../lib/env.js";

export const DEFAULT_LOGIN_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "ads_read",
  "ads_management",
  "business_management",
];

export function normalizeScopes(scopes: string[]): string[] {
  return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];
}

export function defaultScopes(): string[] {
  const envScopes = getCliEnvVar("FB_OAUTH_SCOPES");
  if (!envScopes) return DEFAULT_LOGIN_SCOPES;
  const parsed = normalizeScopes(envScopes.split(","));
  return parsed.length > 0 ? parsed : DEFAULT_LOGIN_SCOPES;
}

export function tokenPreview(token?: string): string | undefined {
  if (!token) return undefined;
  const redacted = redactToken(token);
  if (redacted !== token) return redacted;
  if (token.length <= 10) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export function resolveAuthVersion(runtime: RuntimeContext): string {
  return runtime.apiVersion ?? getCliEnvVar("FB_API_VERSION") ?? DEFAULT_GRAPH_API_VERSION;
}

export function requireAppCredentials(operation: string): { appId: string; appSecret: string } {
  const appId = getCliEnvVar("FB_APP_ID");
  const appSecret = getCliEnvVar("FB_APP_SECRET");
  if (!appId || !appSecret) {
    throw new Error(`FB_APP_ID and FB_APP_SECRET are required for auth ${operation}`);
  }
  return { appId, appSecret };
}

export interface RedirectValidationResult {
  ok: boolean;
  normalized?: string;
  error?: string;
}

export function validateLocalRedirectUri(redirectUri: string): RedirectValidationResult {
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "http:") {
      return {
        ok: false,
        error:
          "OAuth local callback currently supports only http:// redirect URIs (https is not supported here).",
      };
    }
    if (!url.hostname) {
      return { ok: false, error: "Redirect URI must include a hostname." };
    }
    return { ok: true, normalized: url.toString() };
  } catch {
    return { ok: false, error: `Invalid redirect URI: ${redirectUri}` };
  }
}
