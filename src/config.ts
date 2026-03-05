/**
 * Configuration — loads FACEBOOK_ASSETS from environment.
 * Bun auto-loads .env from CWD.
 */

export interface PageAsset {
  fb_page_id: string;
  page_name: string;
  display_name: string;
  page_access_token: string;
}

export const DEFAULT_GRAPH_API_VERSION = "v25.0";

export function getGraphApiBase(
  version = process.env.FB_API_VERSION || DEFAULT_GRAPH_API_VERSION,
): string {
  return `https://graph.facebook.com/${version}`;
}

export const GRAPH_API_VERSION = process.env.FB_API_VERSION || DEFAULT_GRAPH_API_VERSION;
export const GRAPH_API_BASE = getGraphApiBase(GRAPH_API_VERSION);

export function resolveAccessToken(
  cliToken?: string,
  envToken?: string,
  profileToken?: string,
): string | undefined {
  return cliToken ?? envToken ?? profileToken;
}

export function loadAssets(): PageAsset[] {
  const raw = process.env.FACEBOOK_ASSETS ?? "[]";
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("FACEBOOK_ASSETS is not valid JSON");
  }
}

export interface AppConfig {
  appId?: string;
  userToken?: string;
}

export function loadAppConfig(): AppConfig {
  return {
    appId: process.env.FB_APP_ID,
    userToken: process.env.FB_USER_ACCESS_TOKEN,
  };
}
