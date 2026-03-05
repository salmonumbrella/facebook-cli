import { describe, expect, it } from "bun:test";

function runCli(args: string[]) {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "cli/fbcli.ts", "--dry-run", "--access-token", "X", ...args],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: "/tmp",
    },
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

describe("ads command tree smoke", () => {
  it("dispatches full ads command tree", () => {
    const cfgPath = "/tmp/fb-ads-deploy-smoke.yaml";
    Bun.write(
      cfgPath,
      "campaign:\n  objective: OUTCOME_TRAFFIC\nad_set:\n  name: Test\nads:\n  - name: A\n",
    );

    const commands = [
      ["ads", "accounts", "list"],
      ["ads", "accounts", "get", "123"],
      ["ads", "campaigns", "list", "123"],
      ["ads", "campaigns", "get", "cmp_1"],
      ["ads", "campaigns", "create", "123", "{}"],
      ["ads", "campaigns", "update", "cmp_1", "{}"],
      ["ads", "campaigns", "pause", "cmp_1"],
      ["ads", "campaigns", "activate", "cmp_1"],
      ["ads", "campaigns", "delete", "cmp_1"],
      ["ads", "adsets", "list", "123"],
      ["ads", "adsets", "get", "as_1"],
      ["ads", "adsets", "create", "123", "{}"],
      ["ads", "adsets", "update", "as_1", "{}"],
      ["ads", "ads", "list", "123"],
      ["ads", "ads", "get", "ad_1"],
      ["ads", "ads", "create", "123", "{}"],
      ["ads", "ads", "update", "ad_1", "{}"],
      ["ads", "creatives", "list", "123"],
      ["ads", "creatives", "get", "cr_1"],
      ["ads", "creatives", "create", "123", "{}"],
      ["ads", "images", "upload", "123", "{}"],
      ["ads", "insights", "get", "act_123", "{}"],
      ["ads", "audiences", "list", "123"],
      ["ads", "audiences", "get", "au_1"],
      ["ads", "audiences", "create", "123", "{}"],
      ["ads", "audiences", "update", "au_1", "{}"],
      ["ads", "audiences", "delete", "au_1"],
      ["ads", "deploy", cfgPath, "123"],
      ["ads", "validate", cfgPath],
      ["ads", "audience", "search-interests", "shopping"],
      ["ads", "audience", "search-behaviors", "shoppers"],
      ["ads", "audience", "estimate-size", "123", "{}"],
      ["ads", "duplicate", "cmp_src", "123"],
      ["ads", "stats", "collect", "act_123", "2026-03-01", "2026-03-01", "/tmp/fb-stats-smoke"],
      ["ads", "stats", "analyze", '{"data":[{"impressions":1,"clicks":1,"spend":1}] }'],
      [
        "ads",
        "stats",
        "validate",
        '{"data":[{"campaign_id":"c1","date":"2026-03-01","impressions":1,"clicks":1,"spend":1,"ctr":1,"cpc":1,"cpm":1,"conversions":0,"conversion_value":0,"cpa":0,"roas":0}] }',
      ],
      [
        "ads",
        "stats",
        "export",
        '{"data":[{"campaign_id":"c1","date":"2026-03-01","impressions":1,"clicks":1,"spend":1,"ctr":1,"cpc":1,"cpm":1,"conversions":0,"conversion_value":0,"cpa":0,"roas":0}] }',
        "/tmp/fb-stats.csv",
      ],
      [
        "ads",
        "optimize",
        "validate",
        '{"campaign":{"name":"T","total_budget":100},"creatives":[{"id":"c1"}],"targeting_options":{"audiences":[{"id":"a1"}]}}',
      ],
      [
        "ads",
        "optimize",
        "create",
        "123",
        '{"campaign":{"name":"T","total_budget":100},"creatives":[{"id":"c1"}],"targeting_options":{"audiences":[{"id":"a1"}]}}',
      ],
      ["ads", "optimize", "update", "cmp1,cmp2", "15"],
      ["ads", "exportyaml", "cmp_1"],
    ];

    for (const cmd of commands) {
      const res = runCli(cmd);
      expect(res.exitCode).toBe(0);
    }
  });
});
