import { describe, expect, it, mock } from "bun:test";
import { listIgMedia } from "../../src/domains/instagram.js";

describe("instagram domain", () => {
  it("loads media for IG user", async () => {
    const graphApi = mock(async () => ({ data: [] }));
    await listIgMedia({ graphApi } as any, "1784", "TOKEN");
    expect(graphApi.mock.calls[0][1]).toBe("1784/media");
  });
});
