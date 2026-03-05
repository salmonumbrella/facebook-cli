import { describe, expect, it } from "bun:test";

function runCli(args: string[]) {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "cli/fbcli.ts", "--dry-run", "--access-token", "X", ...args],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: "/tmp",
    },
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

describe("social/business command tree smoke", () => {
  it("dispatches business, invoices, ad-library, ig, wa, and page enhancement commands", () => {
    const commands = [
      ["business", "info", "biz_1"],
      ["business", "ad-accounts", "biz_1"],
      ["invoices", "list", "biz_1", "2026-02-01", "2026-02-28"],
      ["invoices", "download", "inv_1"],
      ["ad-library", "search", "shoes"],
      ["ig", "accounts", "list"],
      ["ig", "media", "list", "1784"],
      ["ig", "media", "insights", "mid_1"],
      ["ig", "account", "insights", "1784"],
      ["ig", "comments", "list", "mid_1"],
      ["ig", "comments", "reply", "cid_1", "hello"],
      ["ig", "publish", "1784", "https://example.com/image.jpg", "caption"],
      ["ig", "stories", "list", "1784"],
      ["wa", "send", "pnid", "+15550001111", "hello"],
      ["wa", "templates", "list", "waba_1"],
      ["wa", "templates", "create", "waba_1", "{}"],
      ["wa", "phone-numbers", "list", "waba_1"],
      ["page-insights", "123"],
      ["page-insights", "fans", "123"],
      ["page-insights", "reach", "123"],
      ["page-insights", "views", "123"],
      ["page-insights", "engagement", "123"],
      ["post-local", "123", "/tmp/photo.jpg", "caption"],
      ["draft", "123", "hello", "world"],
      ["me"],
    ];

    for (const cmd of commands) {
      const res = runCli(cmd);
      expect(res.exitCode).toBe(0);
    }
  });
});
