import { describe, expect, it } from "bun:test";
import { parseGlobalOptions } from "../lib/context.js";

describe("global options", () => {
  it("parses --output --dry-run --api-version --access-token", () => {
    const opts = parseGlobalOptions(["--output", "csv", "--dry-run", "--api-version", "v25.0", "--access-token", "X"]);
    expect(opts.output).toBe("csv");
    expect(opts.dryRun).toBe(true);
    expect(opts.apiVersion).toBe("v25.0");
    expect(opts.accessToken).toBe("X");
  });
});
