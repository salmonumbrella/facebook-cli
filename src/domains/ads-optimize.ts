import yaml from "js-yaml";

export interface Deps {
  graphApi: (
    method: string,
    endpoint: string,
    token: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>,
  ) => Promise<any>;
}

interface CampaignConfig {
  name?: string;
  total_budget?: number;
  test_budget_percentage?: number;
  max_cpm?: number;
}

interface OptimizationConfig {
  campaign?: CampaignConfig;
  creatives?: Array<Record<string, unknown>>;
  targeting_options?: {
    audiences?: Array<Record<string, unknown>>;
    placements?: Array<Record<string, unknown>>;
  };
}

export interface Combination {
  kind: "audience" | "placement";
  creative: Record<string, unknown>;
  audience?: Record<string, unknown>;
  placement?: Record<string, unknown>;
}

export function generateCombinations(config: OptimizationConfig): Combination[] {
  const creatives = config.creatives ?? [];
  const audiences = config.targeting_options?.audiences ?? [];
  const placements = config.targeting_options?.placements ?? [];

  const out: Combination[] = [];
  for (const creative of creatives) {
    for (const audience of audiences) {
      out.push({ kind: "audience", creative, audience });
    }
    for (const placement of placements) {
      out.push({ kind: "placement", creative, placement });
    }
  }
  return out;
}

export function allocateBudget(totalBudget: number, testPercent: number, numCombos: number) {
  const testBudget = (totalBudget * testPercent) / 100;
  const perCampaign = numCombos > 0 ? testBudget / numCombos : 0;
  return { totalBudget, testPercent, testBudget, perCampaign };
}

export function validateOptimizationConfig(config: OptimizationConfig) {
  const errors: string[] = [];
  if (!config.campaign?.name) errors.push("campaign.name is required");
  if (!config.campaign?.total_budget) errors.push("campaign.total_budget is required");

  if (!config.creatives || config.creatives.length === 0) {
    errors.push("at least one creative is required");
  }

  const hasAudience = Boolean(config.targeting_options?.audiences?.length);
  const hasPlacement = Boolean(config.targeting_options?.placements?.length);
  if (!hasAudience && !hasPlacement) {
    errors.push("at least one audience or placement is required");
  }

  return { valid: errors.length === 0, errors };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(max = 150): number {
  return Math.floor(Math.random() * max);
}

function accountPath(accountId: string): string {
  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

export async function createTestCampaigns(
  deps: Deps,
  token: string,
  accountId: string,
  config: OptimizationConfig,
  options: {
    limit?: number;
    "batch-size"?: number;
    priority?: "audience" | "placement";
    dryRun?: boolean;
    template?: string;
  } = {},
) {
  const validation = validateOptimizationConfig(config);
  if (!validation.valid) return { ok: false, validation };

  const combos = generateCombinations(config);
  const prioritized = options.priority
    ? combos.sort(
        (a, b) => Number(b.kind === options.priority) - Number(a.kind === options.priority),
      )
    : combos;
  const selected = options.limit ? prioritized.slice(0, options.limit) : prioritized;

  const budget = allocateBudget(
    config.campaign?.total_budget ?? 0,
    config.campaign?.test_budget_percentage ?? 20,
    selected.length,
  );

  if (options.dryRun) {
    return { ok: true, dryRun: true, budget, selected };
  }

  const batchSize = options["batch-size"] ?? 10;
  const created: any[] = [];
  for (let i = 0; i < selected.length; i += batchSize) {
    const batch = selected.slice(i, i + batchSize);
    for (const [offset, combo] of batch.entries()) {
      const nameSuffix = options.template ?? combo.kind;
      const payload: Record<string, string> = {
        name: `${config.campaign?.name ?? "Test"} ${i + offset + 1} (${nameSuffix})`,
        objective: "OUTCOME_TRAFFIC",
        status: "PAUSED",
        daily_budget: String(Math.max(1, Math.round(budget.perCampaign))),
      };
      created.push(
        await deps.graphApi(
          "POST",
          `${accountPath(accountId)}/campaigns`,
          token,
          undefined,
          payload,
        ),
      );
    }
    const delay = 300 * 2 ** Math.floor(i / Math.max(1, batchSize)) + jitter();
    await sleep(delay);
  }

  return { ok: true, createdCount: created.length, created };
}

export async function exportCampaignToYaml(
  deps: Deps,
  token: string,
  campaignId: string,
  options: { budget?: number; "test-percent"?: number; "max-cpm"?: number } = {},
) {
  const campaign = await deps.graphApi("GET", campaignId, token, {
    fields: "id,name,objective,daily_budget",
  });

  const payload = {
    campaign: {
      name: campaign?.name ?? "Exported Campaign",
      total_budget: options.budget ?? Number(campaign?.daily_budget ?? 0),
      test_budget_percentage: options["test-percent"] ?? 20,
      max_cpm: options["max-cpm"] ?? 10,
    },
    creatives: [],
    targeting_options: { audiences: [], placements: [] },
  };

  return yaml.dump(payload, { lineWidth: 120 });
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export async function updateCpmBids(
  deps: Deps,
  token: string,
  campaignIds: string[],
  maxCpm: number,
) {
  const stats: Array<{ campaignId: string; cpm: number; impressions: number }> = [];
  for (const campaignId of campaignIds) {
    const res = await deps.graphApi("GET", `${campaignId}/insights`, token, {
      fields: "cpm,impressions",
      limit: "1",
    });
    const row = Array.isArray(res?.data) ? res.data[0] : undefined;
    stats.push({
      campaignId,
      cpm: Number(row?.cpm ?? 0),
      impressions: Number(row?.impressions ?? 0),
    });
  }

  const cpms = stats.map((s) => s.cpm).filter((v) => Number.isFinite(v));
  const avg = mean(cpms);
  const variance = cpms.length ? cpms.reduce((sum, v) => sum + (v - avg) ** 2, 0) / cpms.length : 0;
  const cap = Math.min(maxCpm, avg + Math.sqrt(variance));

  const worstImpressions = stats.length ? Math.min(...stats.map((s) => s.impressions)) : 0;
  const updates: any[] = [];
  for (const s of stats) {
    if (s.impressions <= worstImpressions) {
      updates.push(
        await deps.graphApi("POST", s.campaignId, token, undefined, { status: "PAUSED" }),
      );
      continue;
    }
    updates.push(
      await deps.graphApi("POST", s.campaignId, token, undefined, {
        bid_amount: String(Math.round(cap * 100)),
      }),
    );
  }

  return { cap, updated: updates.length };
}
