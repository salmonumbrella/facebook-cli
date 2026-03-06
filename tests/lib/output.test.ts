import { describe, expect, it } from "bun:test";
import { formatRows } from "../../src/lib/output.js";

describe("formatRows", () => {
  const rows = [{ id: "1", name: "A" }];

  it("supports json", () => {
    expect(formatRows(rows, "json")).toContain('"id": "1"');
  });

  it("supports csv", () => {
    expect(formatRows(rows, "csv").trim()).toBe("id,name\n1,A");
  });

  it("supports table", () => {
    expect(formatRows(rows, "table")).toContain("id");
    expect(formatRows(rows, "table")).toContain("A");
  });
});
