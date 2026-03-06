import { describe, expect, it } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { createProfileStore } from "../../src/lib/profiles.js";

describe("profile store", () => {
  it("creates default profile when file missing", () => {
    const store = createProfileStore("/tmp/fb-profile-test.json");
    expect(store.load().active).toBe("default");
  });

  it("fails fast on invalid profile file shape", () => {
    const filePath = `/tmp/fb-profile-invalid-${Date.now()}.json`;
    writeFileSync(filePath, JSON.stringify({ active: "default", profiles: [] }));

    try {
      const store = createProfileStore(filePath);
      expect(() => store.load()).toThrow(/invalid shape/i);
    } finally {
      rmSync(filePath, { force: true });
    }
  });
});
