import { describe, expect, it, mock } from "bun:test";
import { searchInterests, searchBehaviors, getAudienceSizeEstimate } from "../../src/domains/ads.js";

describe("audience targeting search", () => {
  it("searches interests via /search?type=adinterest", async () => {
    const graphApi = mock(async () => ({ data: [{ id: "6003107902433", name: "Online shopping", audience_size: 910000000 }] }));
    const out = await searchInterests({ graphApi } as any, "TOKEN", "shopping");
    expect(graphApi.mock.calls[0][1]).toBe("search");
    expect(graphApi.mock.calls[0][3]).toMatchObject({ type: "adinterest", q: "shopping" });
  });

  it("searches behaviors via /search?type=adTargetingCategory&class=behaviors", async () => {
    const graphApi = mock(async () => ({ data: [] }));
    await searchBehaviors({ graphApi } as any, "TOKEN", "shoppers");
    expect(graphApi.mock.calls[0][3].type).toBe("adTargetingCategory");
  });

  it("estimates audience size via /act_{id}/delivery_estimate", async () => {
    const graphApi = mock(async () => ({ data: [{ audience_size_estimate: 15000000 }] }));
    const out = await getAudienceSizeEstimate({ graphApi } as any, "123", "TOKEN", { age_min: 18, age_max: 35, geo_locations: { countries: ["US"] } });
    expect(graphApi.mock.calls[0][1]).toBe("act_123/delivery_estimate");
  });
});
