import type {
  debug as debugFn,
  graphApi as graphApiFn,
  graphApiBatch as graphApiBatchFn,
  isError as isErrorFn,
  paginateAll as paginateAllFn,
  ruploadApi as ruploadApiFn,
} from "../api.js";
import type { getGraphApiBase, PageAsset } from "../config.js";
import { getPageOrThrow } from "../lib/page-registry.js";

export interface CoreToolDeps {
  assets: PageAsset[];
  debug: typeof debugFn;
  getGraphApiBase: typeof getGraphApiBase;
  graphApi: typeof graphApiFn;
  graphApiBatch: typeof graphApiBatchFn;
  isError: typeof isErrorFn;
  paginateAll: typeof paginateAllFn;
  ruploadApi: typeof ruploadApiFn;
}

export const ALL_INSIGHT_METRICS = [
  "post_impressions",
  "post_impressions_unique",
  "post_impressions_paid",
  "post_impressions_organic",
  "post_engaged_users",
  "post_clicks",
  "post_reactions_like_total",
  "post_reactions_love_total",
  "post_reactions_wow_total",
  "post_reactions_haha_total",
  "post_reactions_sorry_total",
  "post_reactions_anger_total",
];

export const REACTION_METRICS = [
  "post_reactions_like_total",
  "post_reactions_love_total",
  "post_reactions_wow_total",
  "post_reactions_haha_total",
  "post_reactions_sorry_total",
  "post_reactions_anger_total",
];

export const NEGATIVE_KEYWORDS = [
  "bad",
  "terrible",
  "awful",
  "hate",
  "dislike",
  "problem",
  "issue",
];

export function getPage(deps: Pick<CoreToolDeps, "assets">, name: string): PageAsset {
  return getPageOrThrow(deps.assets, name);
}

export async function getInsight(
  deps: Pick<CoreToolDeps, "assets" | "graphApi">,
  pageName: string,
  postId: string,
  metric: string,
) {
  const page = getPage(deps, pageName);
  return deps.graphApi("GET", `${postId}/insights`, page.page_access_token, {
    metric,
    period: "lifetime",
  });
}
