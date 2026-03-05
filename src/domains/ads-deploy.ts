import { extname } from "node:path";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";

export interface DeployConfig {
  campaign: Record<string, unknown>;
  ad_set: Record<string, unknown>;
  creative?: Record<string, unknown>;
  ads: Array<Record<string, unknown>>;
  image?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

type GraphFn = (
  method: string,
  endpoint: string,
  token: string,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
) => Promise<any>;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asDeployConfig(value: unknown): DeployConfig {
  const obj = asObject(value);
  return {
    campaign: asObject(obj.campaign),
    ad_set: asObject(obj.ad_set),
    creative: obj.creative ? asObject(obj.creative) : undefined,
    ads: Array.isArray(obj.ads) ? obj.ads.map(asObject) : [],
    image: obj.image ? asObject(obj.image) : undefined,
  };
}

export function readDeployConfig(path: string): DeployConfig {
  const raw = readFileSync(path, "utf8");
  const ext = extname(path).toLowerCase();
  if (ext === ".json") {
    return asDeployConfig(JSON.parse(raw));
  }

  if (ext === ".yml" || ext === ".yaml") {
    return asDeployConfig(yaml.load(raw));
  }

  try {
    return asDeployConfig(JSON.parse(raw));
  } catch {
    return asDeployConfig(yaml.load(raw));
  }
}

export function validateDeployConfig(config: unknown): ValidationResult {
  const parsed = asDeployConfig(config);
  const errors: string[] = [];

  if (!parsed.campaign.objective) {
    errors.push("campaign.objective is required");
  }

  if (!parsed.ad_set) {
    errors.push("ad_set is required");
  }

  if (!Array.isArray(parsed.ads) || parsed.ads.length === 0) {
    errors.push("ads must contain at least one ad");
  }

  return { valid: errors.length === 0, errors };
}

export async function executeDeploy(
  graph: GraphFn,
  token: string,
  accountId: string,
  input: unknown,
  dryRun = false,
): Promise<any> {
  const config = asDeployConfig(input);
  const validation = validateDeployConfig(config);
  if (!validation.valid) {
    return { ok: false, validation };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      steps: ["upload_image", "create_campaign", "create_ad_set", "create_creative", "create_ads"],
      config,
    };
  }

  let imageResult: any;
  if (config.image && Object.keys(config.image).length > 0) {
    imageResult = await graph("POST", `act_${accountId}/adimages`, token, config.image as Record<string, string>);
  }

  const campaign = await graph("POST", `act_${accountId}/campaigns`, token, config.campaign as Record<string, string>);
  const adSetPayload = {
    ...config.ad_set,
    campaign_id: campaign?.id,
  } as Record<string, string>;
  const adSet = await graph("POST", `act_${accountId}/adsets`, token, adSetPayload);

  const creativePayload = {
    ...(config.creative ?? {}),
    ...(imageResult?.images ? { image_hash: Object.keys(imageResult.images)[0] } : {}),
  } as Record<string, string>;
  const creative = await graph("POST", `act_${accountId}/adcreatives`, token, creativePayload);

  const ads: any[] = [];
  for (const ad of config.ads) {
    const adPayload = {
      ...ad,
      adset_id: adSet?.id,
      creative: ad.creative ?? { creative_id: creative?.id },
      status: ad.status ?? "PAUSED",
    } as Record<string, unknown>;
    // For ad creation we pass payload as JSON body.
    ads.push(await graph("POST", `act_${accountId}/ads`, token, undefined, adPayload));
  }

  return {
    ok: true,
    campaignId: campaign?.id,
    adSetId: adSet?.id,
    creativeId: creative?.id,
    adIds: ads.map((x) => x?.id).filter(Boolean),
  };
}
