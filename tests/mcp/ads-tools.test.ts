import { describe, expect, it } from "bun:test";
import { registerAdsTools } from "../../src/tools/ads-tools.js";

describe("registerAdsTools", () => {
  it("registers expected ads MCP tools", () => {
    const names: string[] = [];
    const fakeServer = {
      tool(name: string) {
        names.push(name);
      },
    };

    registerAdsTools(fakeServer as any, {
      graphApi: async () => ({}),
    });

    expect(names).toContain("ads_accounts_list");
    expect(names).toContain("ads_campaigns_create");
    expect(names).toContain("ads_images_upload");
    expect(names).toContain("ads_validate");
  });
});
