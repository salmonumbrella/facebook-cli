import { describe, expect, it } from "bun:test";
import { redactToken } from "../../src/lib/redact.js";

describe("redactToken", () => {
  it("masks EAA tokens", () => {
    expect(redactToken("EAAabcdef1234567890")).toMatch(/^EAAabc\.\.\./);
  });
});
