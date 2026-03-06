import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "../../src/lib/profiles.js";
import type { RuntimeContext } from "../lib/context.js";
import { runAuthLogin, runAuthRefresh, type OAuthFlowDeps } from "../commands/auth/oauth-flow.js";
import { withEnv } from "./helpers.js";

function makeRuntime(profilePath: string): RuntimeContext {
  return {
    output: "json",
    dryRun: false,
    apiVersion: "v25.0",
    accessToken: undefined,
    profileName: "default",
    profilePath,
  };
}

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("auth oauth flow", () => {
  it("continues when browser opener fails and stores token", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-auth-flow-"));
    tempDirs.push(dir);
    const profilePath = join(dir, "profiles.json");
    const runtime = makeRuntime(profilePath);

    const deps: OAuthFlowDeps = {
      openBrowser: () => ({ opened: false, error: "opener missing" }),
      waitForOAuthCallback: async (_redirect, expectedState) => ({
        code: "auth-code",
        state: expectedState,
      }),
      exchangeCodeForToken: async () => ({ access_token: "short-token", expires_in: 3600 }),
      exchangeForLongLivedToken: async () => ({
        access_token: "long-token",
        expires_in: 7200,
        token_type: "bearer",
      }),
      debugToken: async () => ({
        data: {
          is_valid: true,
          scopes: ["ads_read", "ads_management"],
          user_id: "u_1",
          app_id: "123",
        },
      }),
    };

    const result = await withEnv(
      {
        FB_APP_ID: "123",
        FB_APP_SECRET: "secret",
      },
      () => runAuthLogin(["--redirect-uri", "http://localhost:8484/callback"], runtime, deps),
    );

    expect((result as any).ok).toBe(true);
    expect((result as any).browser.opened).toBe(false);
    expect((result as any).browser.error).toContain("opener");

    const stored = createProfileStore(profilePath).load();
    expect(stored.profiles.default?.access_token).toBe("long-token");
    expect(stored.profiles.default?.auth?.is_valid).toBe(true);
  });

  it("fails login on OAuth state mismatch", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-auth-flow-"));
    tempDirs.push(dir);
    const profilePath = join(dir, "profiles.json");
    const runtime = makeRuntime(profilePath);

    const deps: OAuthFlowDeps = {
      openBrowser: () => ({ opened: true }),
      waitForOAuthCallback: async () => ({
        code: "auth-code",
        state: "wrong-state",
      }),
      exchangeCodeForToken: async () => ({ access_token: "short-token" }),
      exchangeForLongLivedToken: async () => ({ access_token: "long-token" }),
      debugToken: async () => ({ data: { is_valid: true, scopes: [] } }),
    };

    await withEnv(
      {
        FB_APP_ID: "123",
        FB_APP_SECRET: "secret",
      },
      async () => {
        await expect(
          runAuthLogin(["--redirect-uri", "http://localhost:8484/callback"], runtime, deps),
        ).rejects.toThrow("OAuth state mismatch");
      },
    );
  });

  it("refresh uses injected deps and updates stored token", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-auth-flow-"));
    tempDirs.push(dir);
    const profilePath = join(dir, "profiles.json");
    const runtime = makeRuntime(profilePath);
    const store = createProfileStore(profilePath);
    store.save({
      active: "default",
      profiles: {
        default: { access_token: "old-token" },
      },
    });

    const deps: OAuthFlowDeps = {
      openBrowser: () => ({ opened: true }),
      waitForOAuthCallback: async () => ({ code: "unused" }),
      exchangeCodeForToken: async () => ({ access_token: "unused" }),
      exchangeForLongLivedToken: async () => ({
        access_token: "new-token",
        expires_in: 1000,
        token_type: "bearer",
      }),
      debugToken: async () => ({ data: { is_valid: true, scopes: ["ads_read"] } }),
    };

    const result = await withEnv(
      {
        FB_APP_ID: "123",
        FB_APP_SECRET: "secret",
      },
      () => runAuthRefresh(runtime, deps),
    );

    expect((result as any).ok).toBe(true);
    expect(store.load().profiles.default?.access_token).toBe("new-token");
  });

  it("surfaces callback listener startup errors clearly", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-auth-flow-"));
    tempDirs.push(dir);
    const runtime = makeRuntime(join(dir, "profiles.json"));

    const deps: OAuthFlowDeps = {
      openBrowser: () => ({ opened: true }),
      waitForOAuthCallback: async () => {
        throw new Error(
          "Failed to start OAuth callback server on port 8484: address already in use.",
        );
      },
      exchangeCodeForToken: async () => ({ access_token: "unused" }),
      exchangeForLongLivedToken: async () => ({ access_token: "unused" }),
      debugToken: async () => ({ data: { is_valid: true, scopes: [] } }),
    };

    await withEnv(
      {
        FB_APP_ID: "123",
        FB_APP_SECRET: "secret",
      },
      async () => {
        await expect(
          runAuthLogin(["--redirect-uri", "http://bad-host.example:8484/callback"], runtime, deps),
        ).rejects.toThrow("address already in use");
      },
    );
  });
});
