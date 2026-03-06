import { describe, expect, it, mock } from "bun:test";
import {
  buildAppAccessToken,
  buildFacebookOAuthUrl,
  clearStoredAuth,
  computeExpiresAt,
  debugToken,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
} from "../../src/lib/auth.js";

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

describe("auth helpers", () => {
  it("builds app access token", () => {
    expect(buildAppAccessToken("123", "secret")).toBe("123|secret");
  });

  it("computes expires_at timestamp", () => {
    expect(computeExpiresAt(60, 0)).toBe("1970-01-01T00:01:00.000Z");
    expect(computeExpiresAt(undefined, 0)).toBeUndefined();
  });

  it("clears stored token and auth metadata", () => {
    const cleared = clearStoredAuth({
      active: "default",
      profiles: {
        default: {
          access_token: "EAA1234",
          auth: { provider: "facebook_oauth", expires_in: 3600 },
          defaults: { page_id: "1" },
        },
      },
    });

    expect(cleared.profiles.default?.access_token).toBeUndefined();
    expect(cleared.profiles.default?.auth).toBeUndefined();
    expect(cleared.profiles.default?.defaults).toEqual({ page_id: "1" });
  });

  it("uses injected fetch for OAuth exchanges", async () => {
    const fetchImpl = mock(async (url: string | URL, init?: RequestInit) => {
      const asUrl = String(url);
      expect(init?.method).toBe("GET");
      if (asUrl.includes("/debug_token")) {
        return new Response('{"data":{"is_valid":true}}', { status: 200 });
      }
      return new Response('{"access_token":"token","expires_in":3600}', { status: 200 });
    }) as unknown as typeof fetch;

    const byCode = await exchangeCodeForToken(
      {
        appId: "123",
        appSecret: "secret",
        redirectUri: "http://localhost:8484/callback",
        code: "auth-code",
        version: "v25.0",
      },
      { fetchImpl },
    );
    expect(byCode.access_token).toBe("token");

    const byExchange = await exchangeForLongLivedToken(
      {
        appId: "123",
        appSecret: "secret",
        accessToken: "short-token",
        version: "v25.0",
      },
      { fetchImpl },
    );
    expect(byExchange.access_token).toBe("token");

    const debug = await debugToken(
      {
        inputToken: "long-token",
        appAccessToken: "123|secret",
        version: "v25.0",
      },
      { fetchImpl },
    );
    expect(debug.data.is_valid).toBe(true);
    expect(fetchImpl.mock.calls.length).toBe(3);
  });
});
