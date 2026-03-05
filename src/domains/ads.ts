export interface Deps {
  graphApi: (
    method: string,
    endpoint: string,
    token: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>,
  ) => Promise<any>;
}

export const listAdAccounts = (deps: Deps, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", "me/adaccounts", token, params);

export const getAdAccount = (deps: Deps, accountId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", `act_${accountId}`, token, params);

export const listCampaigns = (deps: Deps, accountId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", `act_${accountId}/campaigns`, token, params);

export const getCampaign = (deps: Deps, campaignId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", campaignId, token, params);

export const listAdSets = (deps: Deps, accountId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", `act_${accountId}/adsets`, token, params);

export const getAdSet = (deps: Deps, adSetId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", adSetId, token, params);

export const listAds = (deps: Deps, accountId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", `act_${accountId}/ads`, token, params);

export const getAd = (deps: Deps, adId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", adId, token, params);

export const listCreatives = (deps: Deps, accountId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", `act_${accountId}/adcreatives`, token, params);

export const getCreative = (deps: Deps, creativeId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", creativeId, token, params);

export const getInsights = (deps: Deps, accountId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", `act_${accountId}/insights`, token, params);

export const listAudiences = (deps: Deps, accountId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", `act_${accountId}/customaudiences`, token, params);

export const getAudience = (deps: Deps, audienceId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", audienceId, token, params);

export const createCampaign = (
  deps: Deps,
  accountId: string,
  token: string,
  payload: Record<string, unknown>,
) => deps.graphApi("POST", `act_${accountId}/campaigns`, token, payload as any);

export const updateCampaign = (deps: Deps, campaignId: string, token: string, payload: Record<string, unknown>) =>
  deps.graphApi("POST", campaignId, token, payload as any);

export const pauseCampaign = (deps: Deps, campaignId: string, token: string) =>
  deps.graphApi("POST", campaignId, token, { status: "PAUSED" } as any);

export const activateCampaign = (deps: Deps, campaignId: string, token: string) =>
  deps.graphApi("POST", campaignId, token, { status: "ACTIVE" } as any);

export const deleteCampaign = (deps: Deps, campaignId: string, token: string) =>
  deps.graphApi("DELETE", campaignId, token);

export const createAdSet = (
  deps: Deps,
  accountId: string,
  token: string,
  payload: Record<string, unknown>,
) => deps.graphApi("POST", `act_${accountId}/adsets`, token, payload as any);

export const updateAdSet = (deps: Deps, adSetId: string, token: string, payload: Record<string, unknown>) =>
  deps.graphApi("POST", adSetId, token, payload as any);

export const createAd = (
  deps: Deps,
  accountId: string,
  token: string,
  payload: Record<string, unknown>,
) => deps.graphApi("POST", `act_${accountId}/ads`, token, payload as any);

export const updateAd = (deps: Deps, adId: string, token: string, payload: Record<string, unknown>) =>
  deps.graphApi("POST", adId, token, payload as any);

export const createCreative = (
  deps: Deps,
  accountId: string,
  token: string,
  payload: Record<string, unknown>,
) => deps.graphApi("POST", `act_${accountId}/adcreatives`, token, payload as any);

export const uploadImage = (
  deps: Deps,
  accountId: string,
  token: string,
  payload: Record<string, unknown>,
) => deps.graphApi("POST", `act_${accountId}/adimages`, token, payload as any);

export const createAudience = (
  deps: Deps,
  accountId: string,
  token: string,
  payload: Record<string, unknown>,
) => deps.graphApi("POST", `act_${accountId}/customaudiences`, token, payload as any);

export const updateAudience = (deps: Deps, audienceId: string, token: string, payload: Record<string, unknown>) =>
  deps.graphApi("POST", audienceId, token, payload as any);

export const deleteAudience = (deps: Deps, audienceId: string, token: string) =>
  deps.graphApi("DELETE", audienceId, token);
