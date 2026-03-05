import { describe, expect, it, mock } from "bun:test";
import { getInsightsWithBreakdowns } from "../../src/domains/ads.js";

describe("insights breakdowns", () => {
  it("passes breakdowns parameter to insights endpoint", async () => {
    const graphApi = mock(async () => ({ data: [] }));
    await getInsightsWithBreakdowns({ graphApi } as any, "act_123", "TOKEN", {
      breakdowns: "age,gender,country",
      time_range: JSON.stringify({ since: "2026-01-01", until: "2026-01-31" }),
    });
    expect(graphApi.mock.calls[0][3].breakdowns).toBe("age,gender,country");
  });
});
