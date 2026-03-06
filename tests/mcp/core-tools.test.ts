import { describe, expect, it } from "bun:test";
import { registerCoreTools } from "../../src/tools/core-tools.js";

describe("registerCoreTools", () => {
  it("registers page, comment, analytics, and media MCP tools", () => {
    const names: string[] = [];
    const fakeServer = {
      tool(name: string) {
        names.push(name);
      },
    };

    registerCoreTools(fakeServer as any, {
      assets: [
        {
          fb_page_id: "123",
          page_name: "demo",
          display_name: "Demo",
          page_access_token: "token",
        },
      ],
      debug: () => {},
      getGraphApiBase: () => "https://graph.facebook.com/v25.0",
      graphApi: async () => ({}),
      graphApiBatch: async () => [],
      isError: () => false,
      paginateAll: async () => [],
      ruploadApi: async () => ({}),
    });

    expect(names).toContain("list_pages");
    expect(names).toContain("post_to_facebook");
    expect(names).toContain("bulk_hide_comments");
    expect(names).toContain("get_post_insights");
    expect(names).toContain("publish_reel");
    expect(names).toContain("create_ab_test");
  });
});
