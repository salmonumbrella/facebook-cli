import { describe, expect, it } from "bun:test";
import { registerMediaTools } from "../../src/tools/media-tools.js";

describe("registerMediaTools", () => {
  it("registers messaging, story, video, and experiment MCP tools", () => {
    const names: string[] = [];
    const fakeServer = {
      tool(name: string) {
        names.push(name);
      },
    };

    registerMediaTools(fakeServer as any, {
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

    expect(names).toContain("send_dm_to_user");
    expect(names).toContain("publish_video_story");
    expect(names).toContain("publish_reel");
    expect(names).toContain("get_music_recommendations");
    expect(names).toContain("create_ab_test");
  });
});
