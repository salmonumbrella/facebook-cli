import type { ProfileData } from "./profiles.js";
import { fetchWithRetry } from "./http.js";

export interface BuildFacebookOAuthUrlInput {
  appId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
  version: string;
}

export function buildFacebookOAuthUrl(input: BuildFacebookOAuthUrlInput): string {
  const url = new URL(`https://www.facebook.com/${input.version}/dialog/oauth`);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", input.scopes.join(","));
  return url.toString();
}

export function buildAppAccessToken(appId: string, appSecret: string): string {
  return `${appId}|${appSecret}`;
}

export function computeExpiresAt(expiresIn?: number, nowMs = Date.now()): string | undefined {
  if (!expiresIn || !Number.isFinite(expiresIn) || expiresIn <= 0) return undefined;
  return new Date(nowMs + expiresIn * 1000).toISOString();
}

async function parseFacebookJsonResponse(res: Response): Promise<any> {
  const data = await res.json();
  if (!res.ok) {
    const error = data?.error;
    const message =
      typeof error?.message === "string"
        ? error.message
        : `Facebook auth request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

interface AuthHttpDeps {
  fetchImpl?: typeof fetch;
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  return fetchImpl ?? fetch;
}

export interface ExchangeCodeForTokenInput {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
  version: string;
}

export async function exchangeCodeForToken(
  input: ExchangeCodeForTokenInput,
  deps: AuthHttpDeps = {},
): Promise<any> {
  const url = new URL(`https://graph.facebook.com/${input.version}/oauth/access_token`);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("client_secret", input.appSecret);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code", input.code);

  const res = await fetchWithRetry(
    url.toString(),
    { method: "GET" },
    {
      fetchImpl: resolveFetch(deps.fetchImpl),
      breakerKey: "oauth_exchange_code",
    },
  );
  return parseFacebookJsonResponse(res);
}

export interface ExchangeForLongLivedTokenInput {
  appId: string;
  appSecret: string;
  accessToken: string;
  version: string;
}

export async function exchangeForLongLivedToken(
  input: ExchangeForLongLivedTokenInput,
  deps: AuthHttpDeps = {},
): Promise<any> {
  const url = new URL(`https://graph.facebook.com/${input.version}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("client_secret", input.appSecret);
  url.searchParams.set("fb_exchange_token", input.accessToken);

  const res = await fetchWithRetry(
    url.toString(),
    { method: "GET" },
    {
      fetchImpl: resolveFetch(deps.fetchImpl),
      breakerKey: "oauth_exchange_long_lived",
    },
  );
  return parseFacebookJsonResponse(res);
}

export interface DebugTokenInput {
  inputToken: string;
  appAccessToken: string;
  version: string;
}

export async function debugToken(input: DebugTokenInput, deps: AuthHttpDeps = {}): Promise<any> {
  const url = new URL(`https://graph.facebook.com/${input.version}/debug_token`);
  url.searchParams.set("input_token", input.inputToken);
  url.searchParams.set("access_token", input.appAccessToken);
  const res = await fetchWithRetry(
    url.toString(),
    { method: "GET" },
    {
      fetchImpl: resolveFetch(deps.fetchImpl),
      breakerKey: "oauth_debug_token",
    },
  );
  return parseFacebookJsonResponse(res);
}

export interface ProfileStoreLike {
  active: string;
  profiles: Record<string, ProfileData>;
}

export function clearStoredAuth(data: ProfileStoreLike, profileName?: string): ProfileStoreLike {
  const name = profileName ?? data.active;
  const existing = data.profiles[name];
  if (!existing) return data;
  const { access_token: _removed, auth: _authRemoved, ...rest } = existing;
  data.profiles[name] = rest;
  return data;
}
