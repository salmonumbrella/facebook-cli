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

export interface ExchangeCodeForTokenInput {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
  version: string;
}

export async function exchangeCodeForToken(input: ExchangeCodeForTokenInput): Promise<any> {
  const url = new URL(`https://graph.facebook.com/${input.version}/oauth/access_token`);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("client_secret", input.appSecret);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code", input.code);

  const res = await fetch(url.toString(), { method: "GET" });
  return res.json();
}

export interface ExchangeForLongLivedTokenInput {
  appId: string;
  appSecret: string;
  accessToken: string;
  version: string;
}

export async function exchangeForLongLivedToken(
  input: ExchangeForLongLivedTokenInput,
): Promise<any> {
  const url = new URL(`https://graph.facebook.com/${input.version}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("client_secret", input.appSecret);
  url.searchParams.set("fb_exchange_token", input.accessToken);

  const res = await fetch(url.toString(), { method: "GET" });
  return res.json();
}

export interface DebugTokenInput {
  inputToken: string;
  appAccessToken: string;
  version: string;
}

export async function debugToken(input: DebugTokenInput): Promise<any> {
  const url = new URL(`https://graph.facebook.com/${input.version}/debug_token`);
  url.searchParams.set("input_token", input.inputToken);
  url.searchParams.set("access_token", input.appAccessToken);
  const res = await fetch(url.toString(), { method: "GET" });
  return res.json();
}

export interface ProfileRecord {
  access_token?: string;
  defaults?: Record<string, string>;
}

export interface ProfileStoreLike {
  active: string;
  profiles: Record<string, ProfileRecord>;
}

export function clearStoredAuth(data: ProfileStoreLike, profileName?: string): ProfileStoreLike {
  const name = profileName ?? data.active;
  const existing = data.profiles[name];
  if (!existing) return data;
  const { access_token: _removed, ...rest } = existing;
  data.profiles[name] = rest;
  return data;
}
