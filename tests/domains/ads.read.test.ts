import { describe, expect, it, mock } from "bun:test";
import { listCampaigns } from "../../src/domains/ads.js";

describe("ads domain read", () => {
  it("calls /act_{id}/campaigns", async () => {
    const graphApi = mock(async () => ({ data: [] }));
    const out = await listCampaigns({ graphApi } as any, "123", "TOKEN");
    expect(out).toEqual({ data: [] });
    expect(graphApi.mock.calls[0][1]).toBe("act_123/campaigns");
  });
});
