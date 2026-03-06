import { describe, expect, it } from "bun:test";

function runCli(args: string[]) {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "cli/fbcli.ts", ...args],
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

describe("auth/profile/limits smoke", () => {
  it("runs auth status", () => {
    const res = runCli(["auth", "status"]);
    expect(res.exitCode).toBe(0);
  });

  it("runs profile list", () => {
    const res = runCli(["profile", "list"]);
    expect(res.exitCode).toBe(0);
  });

  it("runs auth doctor", () => {
    const res = runCli(["auth", "doctor", "--offline"]);
    expect(res.exitCode).toBe(0);
  });

  it("runs limits check", () => {
    const res = runCli(["limits", "check"]);
    expect(res.exitCode).toBe(0);
  });

  it("honors --output csv for flat command results", () => {
    const res = runCli(["--output", "csv", "auth", "status"]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("authenticated,profile,source,token,auth");
  });
});
