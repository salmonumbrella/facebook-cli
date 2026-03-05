import { describe, expect, it, mock } from "bun:test";
import { duplicateCampaign } from "../../src/domains/ads.js";

describe("campaign duplication", () => {
  it("reads source campaign, adsets, ads, then creates copies", async () => {
    const calls: string[] = [];
    const graphApi = mock(async (_m: string, endpoint: string) => {
      calls.push(endpoint);
      if (endpoint.includes("/adsets")) return { data: [{ id: "as_1", name: "AdSet 1" }] };
      if (endpoint.includes("/ads"))
        return { data: [{ id: "ad_1", name: "Ad 1", creative: { id: "cr_1" } }] };
      return { id: "new_id" };
    });

    await duplicateCampaign({ graphApi } as any, "cmp_src", "TOKEN", "act_123", {
      name: "Copy Campaign",
      budgetFactor: 1.5,
    });

    expect(calls).toContain("cmp_src");
    expect(calls.some((c) => c.includes("act_123/campaigns"))).toBe(true);
  });
});
