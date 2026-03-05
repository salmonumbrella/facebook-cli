import { describe, expect, it, mock } from "bun:test";
import { collectStats, analyzeStats } from "../../src/domains/ads-stats.js";

describe("ads stats", () => {
  it("collects daily insights and stores as JSON", async () => {
    const graphApi = mock(async () => ({
      data: [{
        campaign_id: "123", campaign_name: "Test",
        impressions: "10000", clicks: "500", spend: "100.50",
        ctr: "0.05", cpm: "10.05", cpc: "0.201",
        date_start: "2026-03-01", date_stop: "2026-03-01",
      }],
    }));

    const result = await collectStats({ graphApi } as any, "act_123", "TOKEN", "2026-03-01", "2026-03-01", "/tmp/fb-stats-test");
    expect(result.campaigns).toBe(1);
    expect(result.dataPoints).toBeGreaterThan(0);
  });

  it("calculates min/max/avg/stddev from stored data", () => {
    const data = [
      { impressions: 100, clicks: 10, spend: 5.0 },
      { impressions: 200, clicks: 20, spend: 10.0 },
      { impressions: 300, clicks: 30, spend: 15.0 },
    ];
    const analysis = analyzeStats(data);
    expect(analysis.impressions.avg).toBe(200);
    expect(analysis.impressions.min).toBe(100);
    expect(analysis.impressions.max).toBe(300);
  });
});
