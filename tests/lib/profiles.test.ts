import { describe, expect, it } from "bun:test";
import { createProfileStore } from "../../src/lib/profiles.js";

describe("profile store", () => {
  it("creates default profile when file missing", () => {
    const store = createProfileStore("/tmp/fb-profile-test.json");
    expect(store.load().active).toBe("default");
  });
});
