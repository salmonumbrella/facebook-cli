import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RuntimeContext } from "../lib/context.js";
import { runAuthDoctor, type DoctorDeps } from "../commands/auth/doctor.js";

function makeRuntime(profilePath: string, accessToken?: string): RuntimeContext {
  return {
    output: "json",
    dryRun: false,
    apiVersion: "v25.0",
    accessToken,
    profileName: "default",
    profilePath,
  };
}

function withEnv<T>(values: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  return fn().finally(() => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("auth doctor", () => {
  it("reports offline warning and skips token debug call", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-auth-doctor-"));
    tempDirs.push(dir);
    const runtime = makeRuntime(join(dir, "profiles.json"), "token-1");
    const debugTokenMock = mock(async () => ({ data: { is_valid: true, scopes: ["ads_read"] } }));
    const deps: DoctorDeps = { debugToken: debugTokenMock };

    const result = (await withEnv(
      {
        FB_APP_ID: "123",
        FB_APP_SECRET: "secret",
        FB_OAUTH_REDIRECT_URI: "http://localhost:8484/callback",
      },
      () => runAuthDoctor(["--offline"], runtime, deps),
    )) as any;

    expect(result.ok).toBe(true);
    expect(result.summary.warn).toBe(1);
    expect(
      result.checks.some((check: any) => check.name === "token_debug" && check.status === "warn"),
    ).toBe(true);
    expect(result.nextSteps).toContain(
      "Run `fbcli auth doctor` without --offline to verify token with Facebook",
    );
    expect(debugTokenMock.mock.calls.length).toBe(0);
  });

  it("fails when required scopes are missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-auth-doctor-"));
    tempDirs.push(dir);
    const runtime = makeRuntime(join(dir, "profiles.json"), "token-2");
    const deps: DoctorDeps = {
      debugToken: async () => ({
        data: {
          is_valid: true,
          scopes: ["ads_read"],
        },
      }),
    };

    const result = (await withEnv(
      {
        FB_APP_ID: "123",
        FB_APP_SECRET: "secret",
        FB_OAUTH_REDIRECT_URI: "http://localhost:8484/callback",
      },
      () => runAuthDoctor(["--scopes", "ads_read,ads_management"], runtime, deps),
    )) as any;

    expect(result.ok).toBe(false);
    expect(
      result.checks.some(
        (check: any) =>
          check.name === "token_scopes" &&
          check.status === "fail" &&
          String(check.details).includes("ads_management"),
      ),
    ).toBe(true);
    expect(result.nextSteps).toContain(
      "Re-run `fbcli auth login --scopes ...` with required permissions",
    );
  });

  it("fails invalid redirect uri with actionable next step", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-auth-doctor-"));
    tempDirs.push(dir);
    const runtime = makeRuntime(join(dir, "profiles.json"), "token-3");

    const result = (await withEnv(
      {
        FB_APP_ID: "123",
        FB_APP_SECRET: "secret",
        FB_OAUTH_REDIRECT_URI: "https://localhost:8484/callback",
      },
      () => runAuthDoctor(["--offline"], runtime),
    )) as any;

    expect(result.ok).toBe(false);
    expect(
      result.checks.some(
        (check: any) => check.name === "oauth_redirect_uri" && check.status === "fail",
      ),
    ).toBe(true);
    expect(result.nextSteps).toContain(
      "Set FB_OAUTH_REDIRECT_URI to a valid local http:// callback URL",
    );
  });
});
