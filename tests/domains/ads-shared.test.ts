import { describe, expect, test } from "bun:test";
import { normalizeAccountPath } from "../../src/domains/ads-shared.js";

describe("normalizeAccountPath", () => {
  test("prefixes plain ID with act_", () => {
    expect(normalizeAccountPath("123456")).toBe("act_123456");
  });

  test("leaves act_ prefixed ID unchanged", () => {
    expect(normalizeAccountPath("act_123456")).toBe("act_123456");
  });
});
