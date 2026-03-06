import { afterEach, describe, expect, it } from "bun:test";
import { paginateAll } from "../../src/api.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  // @ts-expect-error test override
  globalThis.fetch = originalFetch;
});

describe("paginateAll", () => {
  it("follows paging.next until exhausted", async () => {
    let calls = 0;
    // @ts-expect-error test override
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) {
        return new Response(
          JSON.stringify({ data: [{ id: "1" }], paging: { next: "https://next" } }),
        );
      }
      return new Response(JSON.stringify({ data: [{ id: "2" }] }));
    };

    const out = await paginateAll<{ id: string }>("https://start");
    expect(out.map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("supports relative paging.next URLs", async () => {
    const calledUrls: string[] = [];
    // @ts-expect-error test override
    globalThis.fetch = async (url: string | URL) => {
      calledUrls.push(String(url));
      if (calledUrls.length === 1) {
        return new Response(
          JSON.stringify({
            data: [{ id: "1" }],
            paging: { next: "/v25.0/next?page=2" },
          }),
        );
      }
      return new Response(JSON.stringify({ data: [{ id: "2" }] }));
    };

    const out = await paginateAll<{ id: string }>("https://graph.facebook.com/v25.0/start");
    expect(out.map((x) => x.id)).toEqual(["1", "2"]);
    expect(calledUrls).toEqual([
      "https://graph.facebook.com/v25.0/start",
      "https://graph.facebook.com/v25.0/next?page=2",
    ]);
  });
});
