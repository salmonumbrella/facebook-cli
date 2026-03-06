import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("comment tools use pagination", () => {
  const serverSrc = readFileSync("src/server.ts", "utf-8");

  test("get_number_of_comments uses paginateAll", () => {
    const toolStart = serverSrc.indexOf('"get_number_of_comments"');
    const handlerArea = serverSrc.slice(toolStart, toolStart + 600);
    expect(handlerArea).toContain("paginateAll");
  });

  test("get_post_top_commenters uses paginateAll", () => {
    const toolStart = serverSrc.indexOf('"get_post_top_commenters"');
    const handlerArea = serverSrc.slice(toolStart, toolStart + 800);
    expect(handlerArea).toContain("paginateAll");
  });
});
