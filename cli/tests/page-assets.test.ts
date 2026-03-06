import { afterEach, describe, expect, it } from "bun:test";
import { mergePageAssets, resolvePageAssets } from "../lib/page-assets.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  // @ts-expect-error test override
  globalThis.fetch = originalFetch;
});

describe("page asset resolution", () => {
  it("merges derived tokens onto configured pages", () => {
    const merged = mergePageAssets(
      [
        {
          fb_page_id: "1",
          page_name: "my-page",
          display_name: "My Page",
          page_access_token: "old-token",
        },
      ],
      [
        {
          fb_page_id: "1",
          page_name: "ignored",
          display_name: "Ignored",
          page_access_token: "new-token",
        },
      ],
    );

    expect(merged).toEqual([
      {
        fb_page_id: "1",
        page_name: "my-page",
        display_name: "My Page",
        page_access_token: "new-token",
      },
    ]);
  });

  it("derives page assets from the logged-in user token when config is empty", async () => {
    // @ts-expect-error test override
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [{ id: "123", name: "My Test Page", access_token: "PAGE_TOKEN" }],
        }),
        { status: 200 },
      );

    const assets = await resolvePageAssets([], "USER_TOKEN");
    expect(assets).toEqual([
      {
        fb_page_id: "123",
        page_name: "my-test-page",
        display_name: "My Test Page",
        page_access_token: "PAGE_TOKEN",
      },
    ]);
  });
});
