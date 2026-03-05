import { describe, expect, it } from "bun:test";
import { generateCombinations, allocateBudget, validateOptimizationConfig } from "../../src/domains/ads-optimize.js";

describe("ads optimization engine", () => {
  it("generates creative x audience x placement combinations", () => {
    const config = {
      campaign: { name: "Test", total_budget: 1000, test_budget_percentage: 20, max_cpm: 15 },
      creatives: [{ id: "c1" }, { id: "c2" }],
      targeting_options: {
        audiences: [{ id: "a1", name: "Young", parameters: { age_min: 18, age_max: 24 } }],
        placements: [{ id: "p1", name: "Feed", position: "feed" }],
      },
    };
    const combos = generateCombinations(config);
    // 2 creatives × (1 audience + 1 placement) = 4 combinations
    expect(combos.length).toBe(4);
  });

  it("allocates budget equally across combinations", () => {
    const allocation = allocateBudget(1000, 20, 4);
    expect(allocation.testBudget).toBe(200);
    expect(allocation.perCampaign).toBe(50);
  });

  it("validates optimization YAML config", () => {
    const result = validateOptimizationConfig({ campaign: {} } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
