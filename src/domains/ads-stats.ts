import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "csv-stringify/sync";

export interface Deps {
  graphApi: (
    method: string,
    endpoint: string,
    token: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>,
  ) => Promise<any>;
}

export interface StatsPoint {
  campaign_id: string;
  campaign_name?: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  conversion_value: number;
  cpa: number;
  roas: number;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stddev(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function summarize(values: number[]) {
  if (values.length === 0) return { min: 0, max: 0, avg: 0, stddev: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, max, avg, stddev: stddev(values, avg) };
}

function normalizeAccountPath(accountId: string): string {
  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

function parseInsightsRow(row: Record<string, unknown>): StatsPoint {
  const conversions = toNumber(row.conversions);
  const conversionValue = toNumber(row.conversion_value);
  const spend = toNumber(row.spend);
  return {
    campaign_id: String(row.campaign_id ?? ""),
    campaign_name: row.campaign_name ? String(row.campaign_name) : undefined,
    date: String(row.date_start ?? ""),
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    spend,
    ctr: toNumber(row.ctr),
    cpc: toNumber(row.cpc),
    cpm: toNumber(row.cpm),
    conversions,
    conversion_value: conversionValue,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: spend > 0 ? conversionValue / spend : 0,
  };
}

export async function collectStats(
  deps: Deps,
  accountId: string,
  token: string,
  startDate: string,
  endDate: string,
  storageDir = `${process.env.HOME ?? "~"}/.config/facebook-cli/stats/daily`,
) {
  mkdirSync(storageDir, { recursive: true });

  const accountPath = normalizeAccountPath(accountId);
  const response = await deps.graphApi("GET", `${accountPath}/insights`, token, {
    level: "campaign",
    time_increment: "1",
    fields: "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,date_start,date_stop,conversions,conversion_value",
    time_range: JSON.stringify({ since: startDate, until: endDate }),
  });

  const rows: Array<Record<string, unknown>> = Array.isArray(response?.data) ? response.data : [];
  const points = rows.map(parseInsightsRow);

  for (const point of points) {
    const filename = `${point.campaign_id}_${point.date}.json`;
    writeFileSync(join(storageDir, filename), JSON.stringify(point, null, 2));
  }

  return {
    campaigns: new Set(points.map((p) => p.campaign_id)).size,
    dataPoints: points.length,
    storageDir,
    points,
  };
}

export function analyzeStats(dataPoints: Array<Record<string, unknown>>) {
  const impressions = dataPoints.map((d) => toNumber(d.impressions));
  const clicks = dataPoints.map((d) => toNumber(d.clicks));
  const spend = dataPoints.map((d) => toNumber(d.spend));
  const ctr = dataPoints.map((d) => toNumber(d.ctr));
  const cpc = dataPoints.map((d) => toNumber(d.cpc));
  const cpm = dataPoints.map((d) => toNumber(d.cpm));

  return {
    impressions: summarize(impressions),
    clicks: summarize(clicks),
    spend: summarize(spend),
    ctr: summarize(ctr),
    cpc: summarize(cpc),
    cpm: summarize(cpm),
    trend: {
      impressions: impressions.length > 1 ? impressions[impressions.length - 1] - impressions[0] : 0,
      clicks: clicks.length > 1 ? clicks[clicks.length - 1] - clicks[0] : 0,
      spend: spend.length > 1 ? spend[spend.length - 1] - spend[0] : 0,
    },
  };
}

export function validateStats(dataPoints: StatsPoint[]) {
  const byCampaign = new Map<string, StatsPoint[]>();
  for (const point of dataPoints) {
    const arr = byCampaign.get(point.campaign_id) ?? [];
    arr.push(point);
    byCampaign.set(point.campaign_id, arr);
  }

  return Array.from(byCampaign.entries()).map(([campaignId, points]) => {
    const impressions = points.reduce((sum, p) => sum + p.impressions, 0);
    const clicks = points.reduce((sum, p) => sum + p.clicks, 0);
    const spend = points.reduce((sum, p) => sum + p.spend, 0);
    const runtimeHours = points.length * 24;
    const pass = impressions >= 1000 && clicks >= 10 && spend >= 1 && runtimeHours >= 24;
    return {
      campaignId,
      pass,
      checks: {
        impressions,
        clicks,
        spend,
        runtimeHours,
      },
      recommendation: pass
        ? "ready_for_optimization"
        : "collect_more_data_before_optimization",
    };
  });
}

export function exportStatsCsv(dataPoints: StatsPoint[], outputPath: string) {
  const csv = stringify(
    dataPoints.map((d) => ({
      campaign_id: d.campaign_id,
      campaign_name: d.campaign_name ?? "",
      date: d.date,
      impressions: d.impressions,
      clicks: d.clicks,
      spend: d.spend,
      ctr: d.ctr,
      cpc: d.cpc,
      cpm: d.cpm,
      conversions: d.conversions,
      cpa: d.cpa,
      roas: d.roas,
    })),
    { header: true },
  );
  writeFileSync(outputPath, csv);
}
