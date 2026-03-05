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

export async function getInsightsWithBreakdowns(
  deps: Deps,
  accountId: string,
  token: string,
  params: Record<string, string>,
) {
  const accountPath = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const response = await deps.graphApi("GET", `${accountPath}/insights`, token, params);
  if (!Array.isArray(response?.data)) return response;

  return {
    ...response,
    data: response.data.map((row: Record<string, unknown>) => {
      const spend = Number(row.spend ?? 0);
      const conversions = Number(row.conversions ?? 0);
      const conversionValue = Number(row.conversion_value ?? 0);
      return {
        ...row,
        cpa: conversions > 0 ? spend / conversions : 0,
        roas: spend > 0 ? conversionValue / spend : 0,
      };
    }),
  };
}

export const listAudiences = (deps: Deps, accountId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", `act_${accountId}/customaudiences`, token, params);

export const getAudience = (deps: Deps, audienceId: string, token: string, params?: Record<string, string>) =>
  deps.graphApi("GET", audienceId, token, params);

// Audience interest search — GET /search?type=adinterest&q=...
export const searchInterests = (deps: Deps, token: string, query: string, limit = 25) =>
  deps.graphApi("GET", "search", token, {
    type: "adinterest",
    q: query,
    limit: String(limit),
  });

// Audience behavior search — GET /search?type=adTargetingCategory&class=behaviors&q=...
export const searchBehaviors = (deps: Deps, token: string, query: string, limit = 25) =>
  deps.graphApi("GET", "search", token, {
    type: "adTargetingCategory",
    class: "behaviors",
    q: query,
    limit: String(limit),
  });

// Audience size estimate — GET /act_{id}/delivery_estimate
export const getAudienceSizeEstimate = (
  deps: Deps,
  accountId: string,
  token: string,
  targetingSpec: Record<string, unknown>,
) =>
  deps.graphApi("GET", `act_${accountId}/delivery_estimate`, token, {
    targeting_spec: JSON.stringify(targetingSpec),
    optimization_goal: "REACH",
  });

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

export interface DuplicateCampaignOptions {
  name?: string;
  budgetFactor?: number;
}

export async function duplicateCampaign(
  deps: Deps,
  campaignId: string,
  token: string,
  accountId: string,
  options: DuplicateCampaignOptions = {},
) {
  const accountPath = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const sourceCampaign = await deps.graphApi("GET", campaignId, token);
  const adSetsRes = await deps.graphApi("GET", `${campaignId}/adsets`, token);
  const sourceAdSets: Array<Record<string, unknown>> = Array.isArray(adSetsRes?.data) ? adSetsRes.data : [];

  const adsByAdSet = new Map<string, Array<Record<string, unknown>>>();
  for (const adSet of sourceAdSets) {
    const adSetId = String(adSet.id ?? "");
    if (!adSetId) continue;
    const adsRes = await deps.graphApi("GET", `${adSetId}/ads`, token);
    adsByAdSet.set(adSetId, Array.isArray(adsRes?.data) ? adsRes.data : []);
  }

  const budgetFactor = options.budgetFactor ?? 1;
  const baseBudget = Number(sourceCampaign?.daily_budget ?? sourceCampaign?.lifetime_budget ?? 0);
  const scaledBudget = baseBudget > 0 ? Math.round(baseBudget * budgetFactor) : undefined;
  const newCampaignPayload: Record<string, string> = {
    ...(sourceCampaign?.objective ? { objective: String(sourceCampaign.objective) } : {}),
    ...(options.name ? { name: options.name } : sourceCampaign?.name ? { name: String(sourceCampaign.name) } : {}),
    ...(scaledBudget ? { daily_budget: String(scaledBudget) } : {}),
    status: "PAUSED",
  };
  const newCampaign = await deps.graphApi("POST", `${accountPath}/campaigns`, token, newCampaignPayload);

  const adSetMap = new Map<string, string>();
  for (const adSet of sourceAdSets) {
    const adSetId = String(adSet.id ?? "");
    if (!adSetId) continue;
    const payload: Record<string, string> = {
      ...(adSet.name ? { name: String(adSet.name) } : {}),
      campaign_id: String(newCampaign?.id ?? ""),
      status: "PAUSED",
    };
    const createdAdSet = await deps.graphApi("POST", `${accountPath}/adsets`, token, payload);
    if (createdAdSet?.id) adSetMap.set(adSetId, String(createdAdSet.id));
  }

  const createdAds: any[] = [];
  for (const [oldAdSetId, ads] of adsByAdSet.entries()) {
    for (const ad of ads) {
      const payload: Record<string, unknown> = {
        ...(ad.name ? { name: String(ad.name) } : {}),
        adset_id: adSetMap.get(oldAdSetId),
        creative: ad.creative ?? undefined,
        status: "PAUSED",
      };
      createdAds.push(await deps.graphApi("POST", `${accountPath}/ads`, token, undefined, payload));
    }
  }

  return {
    campaign: newCampaign,
    adSetCount: adSetMap.size,
    adCount: createdAds.length,
  };
}
