import type { PageAsset } from "../config.js";

export interface PageSummary {
  page_name: string;
  display_name: string;
  fb_page_id: string;
}

export function listPageSummaries(assets: PageAsset[]): PageSummary[] {
  return assets.map((asset) => ({
    page_name: asset.page_name,
    display_name: asset.display_name,
    fb_page_id: asset.fb_page_id,
  }));
}

export function getPageOrThrow(assets: PageAsset[], name: string): PageAsset {
  const page = assets.find((asset) => asset.page_name === name);
  if (page) return page;

  const available = assets.map((asset) => asset.page_name).join(", ") || "(none configured)";
  throw new Error(`Page '${name}' not found. Available pages: ${available}`);
}

export function getDefaultPageAsset(assets: PageAsset[]): PageAsset | undefined {
  return assets[0];
}
