import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("docs coverage", () => {
  it("lists all required command groups in CLI reference", () => {
    const reference = readFileSync("CLI-REFERENCE.md", "utf8").toLowerCase();
    const required = [
      "auth",
      "profile",
      "ads",
      "business",
      "invoices",
      "ad-library",
      "ig",
      "wa",
      "page-insights",
    ];

    for (const group of required) {
      expect(reference).toContain(group);
    }
  });
});
