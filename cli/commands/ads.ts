import {
  listAdAccounts,
  getAdAccount,
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  pauseCampaign,
  activateCampaign,
  deleteCampaign,
  listAdSets,
  getAdSet,
  createAdSet,
  updateAdSet,
  listAds,
  getAd,
  createAd,
  updateAd,
  listCreatives,
  getCreative,
  createCreative,
  uploadImage,
  getInsights,
  listAudiences,
  getAudience,
  createAudience,
  updateAudience,
  deleteAudience,
  searchInterests,
  searchBehaviors,
  getAudienceSizeEstimate,
  duplicateCampaign,
  getInsightsWithBreakdowns,
} from "../../src/domains/ads.js";
import { readDeployConfig, validateDeployConfig, executeDeploy } from "../../src/domains/ads-deploy.js";
import { collectStats, analyzeStats, validateStats, exportStatsCsv } from "../../src/domains/ads-stats.js";
import {
  validateOptimizationConfig,
  createTestCampaigns,
  updateCpmBids,
  exportCampaignToYaml,
} from "../../src/domains/ads-optimize.js";
import type { RuntimeContext } from "../lib/context.js";
import { graphApi } from "../../src/api.js";

type Deps = { graphApi: typeof graphApi };

function requireToken(runtime: RuntimeContext) {
  if (!runtime.accessToken) throw new Error("Missing access token. Use --access-token or profile/env token.");
  return runtime.accessToken;
}

function deps(): Deps {
  return { graphApi };
}

function parseJsonArg(value?: string): Record<string, unknown> {
  if (!value) return {};
  return JSON.parse(value);
}

export async function handleAdsCommand(args: string[], runtime: RuntimeContext): Promise<unknown> {
  const token = runtime.accessToken;
  const d = deps();
  const [group, action, ...rest] = args;

  if (!group) throw new Error("Usage: fbcli ads <group> <action> ...");

  if (group === "deploy") {
    const configPath = action;
    const accountId = rest[0];
    if (!configPath) throw new Error("Usage: fbcli ads deploy <config-path> <account-id>");
    const config = readDeployConfig(configPath);
    if (runtime.dryRun || !token || !accountId) return { ok: true, dryRun: true, valid: validateDeployConfig(config) };
    return executeDeploy(d.graphApi, token, accountId, config, runtime.dryRun);
  }

  if (group === "validate") {
    const configPath = action;
    if (!configPath) throw new Error("Usage: fbcli ads validate <config-path>");
    return validateDeployConfig(readDeployConfig(configPath));
  }

  if (group === "audience") {
    const sub = action;
    if (sub === "search-interests") return searchInterests(d, requireToken(runtime), rest[0] ?? "");
    if (sub === "search-behaviors") return searchBehaviors(d, requireToken(runtime), rest[0] ?? "");
    if (sub === "estimate-size") {
      return getAudienceSizeEstimate(d, rest[0] ?? "", requireToken(runtime), parseJsonArg(rest[1]));
    }
    throw new Error("Usage: fbcli ads audience <search-interests|search-behaviors|estimate-size> ...");
  }

  if (group === "duplicate") {
    if (runtime.dryRun || !token) return { ok: true, dryRun: true, route: "ads duplicate" };
    return duplicateCampaign(d, action ?? "", token, rest[0] ?? "", {
      name: rest[1],
      budgetFactor: rest[2] ? Number(rest[2]) : undefined,
    });
  }

  if (group === "stats") {
    if (action === "collect") {
      const [accountId, since, until, storage] = rest;
      if (!accountId || !since || !until) throw new Error("Usage: fbcli ads stats collect <account-id> <since> <until> [storage-dir]");
      if (runtime.dryRun || !token) return { ok: true, dryRun: true, route: "ads stats collect" };
      return collectStats(d, accountId, token, since, until, storage);
    }
    if (action === "analyze") return analyzeStats(parseJsonArg(rest[0]).data as Array<Record<string, unknown>> ?? []);
    if (action === "validate") return validateStats((parseJsonArg(rest[0]).data as any[]) ?? []);
    if (action === "export") {
      const data = (parseJsonArg(rest[0]).data as any[]) ?? [];
      const outPath = rest[1] ?? "/tmp/facebook-cli-stats.csv";
      exportStatsCsv(data, outPath);
      return { ok: true, output: outPath };
    }
    throw new Error("Usage: fbcli ads stats <collect|analyze|validate|export> ...");
  }

  if (group === "optimize") {
    if (action === "validate") return validateOptimizationConfig(parseJsonArg(rest[0]));
    if (action === "create") {
      if (runtime.dryRun || !token) return { ok: true, dryRun: true, route: "ads optimize create" };
      return createTestCampaigns(d, token, rest[0] ?? "", parseJsonArg(rest[1]));
    }
    if (action === "update") {
      if (runtime.dryRun || !token) return { ok: true, dryRun: true, route: "ads optimize update" };
      const ids = (rest[0] ?? "").split(",").filter(Boolean);
      return updateCpmBids(d, token, ids, Number(rest[1] ?? "0"));
    }
    throw new Error("Usage: fbcli ads optimize <validate|create|update> ...");
  }

  if (group === "exportyaml") {
    if (!token) throw new Error("Missing access token. Use --access-token or profile/env token.");
    return exportCampaignToYaml(d, token, action ?? "");
  }

  if (!token && !runtime.dryRun) {
    throw new Error("Missing access token. Use --access-token or profile/env token.");
  }

  // Core tree: accounts/campaigns/adsets/ads/creatives/images/insights/audiences
  if (group === "accounts") {
    if (action === "list") return runtime.dryRun ? { ok: true, route: "ads accounts list" } : listAdAccounts(d, token!);
    if (action === "get") return runtime.dryRun ? { ok: true, route: "ads accounts get" } : getAdAccount(d, rest[0] ?? "", token!);
  }

  if (group === "campaigns") {
    if (action === "list") return runtime.dryRun ? { ok: true, route: "ads campaigns list" } : listCampaigns(d, rest[0] ?? "", token!);
    if (action === "get") return runtime.dryRun ? { ok: true, route: "ads campaigns get" } : getCampaign(d, rest[0] ?? "", token!);
    if (action === "create") return runtime.dryRun ? { ok: true, route: "ads campaigns create" } : createCampaign(d, rest[0] ?? "", token!, parseJsonArg(rest[1]));
    if (action === "update") return runtime.dryRun ? { ok: true, route: "ads campaigns update" } : updateCampaign(d, rest[0] ?? "", token!, parseJsonArg(rest[1]));
    if (action === "pause") return runtime.dryRun ? { ok: true, route: "ads campaigns pause" } : pauseCampaign(d, rest[0] ?? "", token!);
    if (action === "activate") return runtime.dryRun ? { ok: true, route: "ads campaigns activate" } : activateCampaign(d, rest[0] ?? "", token!);
    if (action === "delete") return runtime.dryRun ? { ok: true, route: "ads campaigns delete" } : deleteCampaign(d, rest[0] ?? "", token!);
  }

  if (group === "adsets") {
    if (action === "list") return runtime.dryRun ? { ok: true, route: "ads adsets list" } : listAdSets(d, rest[0] ?? "", token!);
    if (action === "get") return runtime.dryRun ? { ok: true, route: "ads adsets get" } : getAdSet(d, rest[0] ?? "", token!);
    if (action === "create") return runtime.dryRun ? { ok: true, route: "ads adsets create" } : createAdSet(d, rest[0] ?? "", token!, parseJsonArg(rest[1]));
    if (action === "update") return runtime.dryRun ? { ok: true, route: "ads adsets update" } : updateAdSet(d, rest[0] ?? "", token!, parseJsonArg(rest[1]));
  }

  if (group === "ads") {
    if (action === "list") return runtime.dryRun ? { ok: true, route: "ads ads list" } : listAds(d, rest[0] ?? "", token!);
    if (action === "get") return runtime.dryRun ? { ok: true, route: "ads ads get" } : getAd(d, rest[0] ?? "", token!);
    if (action === "create") return runtime.dryRun ? { ok: true, route: "ads ads create" } : createAd(d, rest[0] ?? "", token!, parseJsonArg(rest[1]));
    if (action === "update") return runtime.dryRun ? { ok: true, route: "ads ads update" } : updateAd(d, rest[0] ?? "", token!, parseJsonArg(rest[1]));
  }

  if (group === "creatives") {
    if (action === "list") return runtime.dryRun ? { ok: true, route: "ads creatives list" } : listCreatives(d, rest[0] ?? "", token!);
    if (action === "get") return runtime.dryRun ? { ok: true, route: "ads creatives get" } : getCreative(d, rest[0] ?? "", token!);
    if (action === "create") return runtime.dryRun ? { ok: true, route: "ads creatives create" } : createCreative(d, rest[0] ?? "", token!, parseJsonArg(rest[1]));
  }

  if (group === "images" && action === "upload") {
    return runtime.dryRun ? { ok: true, route: "ads images upload" } : uploadImage(d, rest[0] ?? "", token!, parseJsonArg(rest[1]));
  }

  if (group === "insights" && action === "get") {
    const params = parseJsonArg(rest[1]) as Record<string, string>;
    if (params.breakdowns) {
      return runtime.dryRun ? { ok: true, route: "ads insights get", breakdowns: params.breakdowns } : getInsightsWithBreakdowns(d, rest[0] ?? "", token!, params);
    }
    return runtime.dryRun ? { ok: true, route: "ads insights get" } : getInsights(d, rest[0] ?? "", token!, params);
  }

  if (group === "audiences") {
    if (action === "list") return runtime.dryRun ? { ok: true, route: "ads audiences list" } : listAudiences(d, rest[0] ?? "", token!);
    if (action === "get") return runtime.dryRun ? { ok: true, route: "ads audiences get" } : getAudience(d, rest[0] ?? "", token!);
    if (action === "create") return runtime.dryRun ? { ok: true, route: "ads audiences create" } : createAudience(d, rest[0] ?? "", token!, parseJsonArg(rest[1]));
    if (action === "update") return runtime.dryRun ? { ok: true, route: "ads audiences update" } : updateAudience(d, rest[0] ?? "", token!, parseJsonArg(rest[1]));
    if (action === "delete") return runtime.dryRun ? { ok: true, route: "ads audiences delete" } : deleteAudience(d, rest[0] ?? "", token!);
  }

  throw new Error(`Unknown ads command path: ${args.join(" ")}`);
}
