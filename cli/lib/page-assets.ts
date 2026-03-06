import type { PageAsset } from "../../src/config.js";
import { getGraphApiBase } from "../../src/config.js";
import { paginateAll } from "../../src/api.js";

interface GraphPageAccount {
  id?: string;
  name?: string;
  access_token?: string;
}

function slugifyPageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function uniquePageName(displayName: string, pageId: string, used: Set<string>): string {
  const base = slugifyPageName(displayName) || `page-${pageId.slice(-6)}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export async function derivePageAssetsFromUserToken(accessToken: string): Promise<PageAsset[]> {
  const firstUrl = new URL(`${getGraphApiBase()}/me/accounts`);
  firstUrl.searchParams.set("access_token", accessToken);
  firstUrl.searchParams.set("fields", "id,name,access_token");
  firstUrl.searchParams.set("limit", "100");

  const rows = await paginateAll<GraphPageAccount>(firstUrl.toString());
  const used = new Set<string>();

  return rows.flatMap((row) => {
    if (!row.id || !row.access_token) return [];
    const displayName = row.name?.trim() || `Page ${row.id}`;
    return [
      {
        fb_page_id: row.id,
        page_name: uniquePageName(displayName, row.id, used),
        display_name: displayName,
        page_access_token: row.access_token,
      },
    ];
  });
}

export function mergePageAssets(configured: PageAsset[], derived: PageAsset[]): PageAsset[] {
  if (configured.length === 0) return derived;
  if (derived.length === 0) return configured;

  const byId = new Map(configured.map((asset) => [asset.fb_page_id, asset]));
  for (const asset of derived) {
    const existing = byId.get(asset.fb_page_id);
    byId.set(
      asset.fb_page_id,
      existing ? { ...existing, page_access_token: asset.page_access_token } : asset,
    );
  }
  return Array.from(byId.values());
}

export async function resolvePageAssets(
  configuredAssets: PageAsset[],
  accessToken?: string,
): Promise<PageAsset[]> {
  if (!accessToken) return configuredAssets;

  try {
    const derivedAssets = await derivePageAssetsFromUserToken(accessToken);
    return mergePageAssets(configuredAssets, derivedAssets);
  } catch (error) {
    if (configuredAssets.length > 0) return configuredAssets;
    throw error;
  }
}
