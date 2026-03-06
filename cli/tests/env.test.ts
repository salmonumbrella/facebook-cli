import { describe, expect, it } from "bun:test";
import { parseCliEnv } from "../lib/env.js";

describe("cli env parser", () => {
  it("parses quoted and unquoted values", () => {
    const parsed = parseCliEnv(
      `FB_APP_ID="123"\nFB_APP_SECRET=secret\n# comment\nFB_OAUTH_REDIRECT_URI='http://localhost:8484/callback'\n`,
    );
    expect(parsed.FB_APP_ID).toBe("123");
    expect(parsed.FB_APP_SECRET).toBe("secret");
    expect(parsed.FB_OAUTH_REDIRECT_URI).toBe("http://localhost:8484/callback");
  });
});
