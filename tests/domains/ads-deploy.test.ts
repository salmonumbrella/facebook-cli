import { describe, expect, it } from "bun:test";
import { validateDeployConfig } from "../../src/domains/ads-deploy.js";

describe("ads deploy validation", () => {
  it("rejects missing campaign objective", () => {
    const result = validateDeployConfig({ campaign: {}, ad_set: {}, ads: [] } as any);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("campaign.objective");
  });

  it("rejects missing ad_set", () => {
    const result = validateDeployConfig({
      campaign: { objective: "OUTCOME_TRAFFIC" },
      ads: [{}],
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some((x) => x.includes("ad_set"))).toBe(true);
  });
});
