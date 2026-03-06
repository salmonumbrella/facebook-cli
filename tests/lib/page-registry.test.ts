import { describe, expect, it } from "bun:test";
import {
  getDefaultPageAsset,
  getPageOrThrow,
  listPageSummaries,
} from "../../src/lib/page-registry.js";

const assets = [
  {
    fb_page_id: "1",
    page_name: "alpha",
    display_name: "Alpha",
    page_access_token: "token-1",
  },
  {
    fb_page_id: "2",
    page_name: "beta",
    display_name: "Beta",
    page_access_token: "token-2",
  },
];

describe("page registry helpers", () => {
  it("lists page summaries", () => {
    expect(listPageSummaries(assets)).toEqual([
      { fb_page_id: "1", page_name: "alpha", display_name: "Alpha" },
      { fb_page_id: "2", page_name: "beta", display_name: "Beta" },
    ]);
  });

  it("looks up a page by name", () => {
    expect(getPageOrThrow(assets, "beta").fb_page_id).toBe("2");
  });

  it("returns the default page when present", () => {
    expect(getDefaultPageAsset(assets)?.page_name).toBe("alpha");
  });
});
