/**
 * Configuration — loads FACEBOOK_ASSETS from environment.
 * Bun auto-loads .env from CWD.
 */

import { z } from "zod";

const pageAssetSchema = z.object({
  fb_page_id: z.string().min(1),
  page_name: z.string().min(1),
  display_name: z.string().min(1),
  page_access_token: z.string().min(1),
});

export type PageAsset = z.infer<typeof pageAssetSchema>;

const pageAssetsSchema = z.array(pageAssetSchema);

export const DEFAULT_GRAPH_API_VERSION = "v25.0";

export function getGraphApiVersion(version = process.env.FB_API_VERSION): string {
  return version || DEFAULT_GRAPH_API_VERSION;
}

export function getGraphApiBase(version = getGraphApiVersion()): string {
  return `https://graph.facebook.com/${version}`;
}

export function resolveAccessToken(
  cliToken?: string,
  envToken?: string,
  profileToken?: string,
): string | undefined {
  return cliToken ?? envToken ?? profileToken;
}

export function parsePageAssets(input: unknown): PageAsset[] {
  const parsed = pageAssetsSchema.safeParse(input);
  if (parsed.success) return parsed.data;

  const issue = parsed.error.issues[0];
  const path = issue?.path.length ? issue.path.join(".") : "FACEBOOK_ASSETS";
  throw new Error(
    `FACEBOOK_ASSETS has invalid shape at '${path}': ${issue?.message ?? "invalid value"}`,
  );
}

export function loadAssets(): PageAsset[] {
  const raw = process.env.FACEBOOK_ASSETS ?? "[]";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("FACEBOOK_ASSETS is not valid JSON");
  }
  return parsePageAssets(parsed);
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
