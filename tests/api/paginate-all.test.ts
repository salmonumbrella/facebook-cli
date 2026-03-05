import { describe, expect, it } from "bun:test";
import { paginateAll } from "../../src/api.js";

describe("paginateAll", () => {
  it("follows paging.next until exhausted", async () => {
    let calls = 0;
    // @ts-expect-error test override
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) {
        return new Response(JSON.stringify({ data: [{ id: "1" }], paging: { next: "https://next" } }));
      }
      return new Response(JSON.stringify({ data: [{ id: "2" }] }));
    };

    const out = await paginateAll<{ id: string }>("https://start");
    expect(out.map((x) => x.id)).toEqual(["1", "2"]);
  });
});
