import { describe, expect, it } from "bun:test";
import { getGraphApiBase, resolveAccessToken } from "../../src/config.js";

describe("runtime config", () => {
  it("builds Graph base URL from explicit version", () => {
    expect(getGraphApiBase("v25.0")).toBe("https://graph.facebook.com/v25.0");
  });

  it("resolves token precedence cli > env > profile", () => {
    expect(resolveAccessToken("cli", "env", "profile")).toBe("cli");
    expect(resolveAccessToken(undefined, "env", "profile")).toBe("env");
    expect(resolveAccessToken(undefined, undefined, "profile")).toBe("profile");
  });
});
