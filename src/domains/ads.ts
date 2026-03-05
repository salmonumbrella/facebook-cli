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
