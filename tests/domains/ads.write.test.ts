import { describe, expect, it, mock } from "bun:test";
import { pauseCampaign } from "../../src/domains/ads.js";

describe("ads mutation", () => {
  it("pauses campaign via status=PAUSED", async () => {
    const graphApi = mock(async () => ({ success: true }));
    await pauseCampaign({ graphApi } as any, "cmp_1", "TOKEN");
    expect(graphApi.mock.calls[0][0]).toBe("POST");
    expect(graphApi.mock.calls[0][1]).toBe("cmp_1");
    expect(graphApi.mock.calls[0][3]).toEqual({ status: "PAUSED" });
  });
});
