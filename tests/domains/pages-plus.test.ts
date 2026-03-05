import { describe, expect, it, mock } from "bun:test";
import { getPageInsightsMetric } from "../../src/domains/pages-plus.js";

describe("pages-plus", () => {
  it("queries page metric endpoint", async () => {
    const graphApi = mock(async () => ({ data: [] }));
    await getPageInsightsMetric({ graphApi } as any, "123", "TOKEN", "page_fans", "day");
    expect(graphApi.mock.calls[0][1]).toBe("123/insights/page_fans");
  });
});
