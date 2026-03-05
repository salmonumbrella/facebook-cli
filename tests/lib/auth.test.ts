import { describe, expect, it } from "bun:test";
import { buildFacebookOAuthUrl } from "../../src/lib/auth.js";

describe("buildFacebookOAuthUrl", () => {
  it("includes client_id, state, redirect_uri and scopes", () => {
    const url = buildFacebookOAuthUrl({
      appId: "123",
      redirectUri: "http://localhost:8484/callback",
      state: "state123",
      scopes: ["pages_manage_posts", "ads_management"],
      version: "v25.0",
    });

    expect(url).toContain("client_id=123");
    expect(url).toContain("state=state123");
    expect(url).toContain("scope=pages_manage_posts%2Cads_management");
  });
});
