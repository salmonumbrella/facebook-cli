import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("comment tools use pagination", () => {
  const analyticsSrc = readFileSync("src/tools/analytics-tools.ts", "utf-8");

  test("get_number_of_comments uses paginateAll", () => {
    const toolStart = analyticsSrc.indexOf('"get_number_of_comments"');
    const handlerArea = analyticsSrc.slice(toolStart, toolStart + 800);
    expect(handlerArea).toContain("paginateAll");
  });

  test("get_post_top_commenters uses paginateAll", () => {
    const toolStart = analyticsSrc.indexOf('"get_post_top_commenters"');
    const handlerArea = analyticsSrc.slice(toolStart, toolStart + 1200);
    expect(handlerArea).toContain("paginateAll");
  });
});
