export interface Deps {
  graphApi: (
    method: string,
    endpoint: string,
    token: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>,
  ) => Promise<any>;
}

export async function listIgAccounts(deps: Deps, token: string) {
  const pages = await deps.graphApi("GET", "me/accounts", token, {
    fields: "id,name,instagram_business_account",
  });

  if (!Array.isArray(pages?.data)) return { data: [] };
  return {
    data: pages.data
      .filter((p: Record<string, unknown>) => p.instagram_business_account)
      .map((p: Record<string, unknown>) => ({
        page_id: p.id,
        page_name: p.name,
        ig_account_id: (p.instagram_business_account as Record<string, unknown>)?.id,
      })),
  };
}

export const listIgMedia = (
  deps: Deps,
  igUserId: string,
  token: string,
  params?: Record<string, string>,
) => deps.graphApi("GET", `${igUserId}/media`, token, params);

export const getIgMediaInsights = (
  deps: Deps,
  mediaId: string,
  token: string,
  metric = "reach,likes,comments,saved,engagement,impressions,views,shares,total_interactions",
) => deps.graphApi("GET", `${mediaId}/insights`, token, { metric });

export const getIgAccountInsights = (
  deps: Deps,
  igUserId: string,
  token: string,
  metric = "reach,impressions,profile_views,follower_count",
  period = "day",
) => deps.graphApi("GET", `${igUserId}/insights`, token, { metric, period });

export const listIgComments = (
  deps: Deps,
  mediaId: string,
  token: string,
  params?: Record<string, string>,
) => deps.graphApi("GET", `${mediaId}/comments`, token, params);

export const replyIgComment = (deps: Deps, commentId: string, token: string, message: string) =>
  deps.graphApi("POST", `${commentId}/replies`, token, undefined, { message });

export async function publishIgMedia(
  deps: Deps,
  igUserId: string,
  token: string,
  media: { image_url?: string; video_url?: string; caption?: string; media_type?: string },
) {
  const createRes = await deps.graphApi("POST", `${igUserId}/media`, token, undefined, {
    ...(media.image_url ? { image_url: media.image_url } : {}),
    ...(media.video_url ? { video_url: media.video_url } : {}),
    ...(media.caption ? { caption: media.caption } : {}),
    ...(media.media_type ? { media_type: media.media_type } : {}),
  });

  return deps.graphApi("POST", `${igUserId}/media_publish`, token, undefined, {
    creation_id: String(createRes?.id ?? ""),
  });
}

export const listIgStories = (
  deps: Deps,
  igUserId: string,
  token: string,
  params?: Record<string, string>,
) => deps.graphApi("GET", `${igUserId}/stories`, token, params);
