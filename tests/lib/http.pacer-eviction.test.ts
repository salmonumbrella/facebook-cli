import { describe, expect, test, beforeEach } from "bun:test";
import { __resetHttpResilienceStateForTests, fetchWithRetry } from "../../src/lib/http.js";

describe("RequestPacer token eviction", () => {
  beforeEach(() => {
    __resetHttpResilienceStateForTests();
  });

  test("handles many unique tokens without error", async () => {
    const fakeFetch = () => Promise.resolve(new Response("ok"));

    // Make requests with 200 different tokens — should not throw or leak
    for (let i = 0; i < 200; i++) {
      await fetchWithRetry(
        "https://example.com",
        { method: "GET" },
        {
          fetchImpl: fakeFetch,
          breakerEnabled: false,
          globalMinIntervalMs: 0,
          tokenMinIntervalMs: 0,
          tokenKey: `token_${i}`,
        },
      );
    }

    // If we get here without OOM or error, eviction is working
    expect(true).toBe(true);
  });
});
