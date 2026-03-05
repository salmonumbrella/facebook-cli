import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GRAPH_API_BASE } from "../config.js";

export interface Deps {
  graphApi: (
    method: string,
    endpoint: string,
    token: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>,
  ) => Promise<any>;
}

export const getPageInsightsMetric = (
  deps: Deps,
  pageId: string,
  token: string,
  metric: string,
  period = "day",
) => deps.graphApi("GET", `${pageId}/insights/${metric}`, token, { period });

export async function uploadLocalPhoto(
  _deps: Deps,
  pageId: string,
  token: string,
  filePath: string,
  caption?: string,
) {
  const form = new FormData();
  const data = readFileSync(filePath);
  form.set("source", new Blob([data]), basename(filePath));
  if (caption) form.set("caption", caption);

  const url = new URL(`${GRAPH_API_BASE}/${pageId}/photos`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), { method: "POST", body: form });
  return res.json();
}

export const createDraftPost = (
  deps: Deps,
  pageId: string,
  token: string,
  message: string,
  params?: Record<string, string>,
) =>
  deps.graphApi("POST", `${pageId}/feed`, token, {
    message,
    published: "false",
    unpublished_content_type: "DRAFT",
    ...(params ?? {}),
  });

export const getMe = (deps: Deps, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", "me", token, params);
