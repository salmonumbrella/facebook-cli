import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("comment tool schemas", () => {
  const serverSrc = readFileSync("src/server.ts", "utf-8");

  test("reply_to_comment schema does not include post_id", () => {
    const match = serverSrc.match(/server\.tool\(\s*"reply_to_comment"[\s\S]*?\{([^}]+)\}/);
    expect(match).toBeTruthy();
    expect(match![1]).not.toContain("post_id");
  });

  test("delete_comment_from_post schema does not include post_id", () => {
    const match = serverSrc.match(/server\.tool\(\s*"delete_comment_from_post"[\s\S]*?\{([^}]+)\}/);
    expect(match).toBeTruthy();
    expect(match![1]).not.toContain("post_id");
  });
});
