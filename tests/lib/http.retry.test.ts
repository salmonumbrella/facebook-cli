import { describe, expect, it, mock } from "bun:test";
import { fetchWithRetry } from "../../src/lib/http.js";

describe("fetchWithRetry", () => {
  it("retries 429 and then succeeds", async () => {
    const fetchMock = mock(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return new Response("{}", { status: 429, headers: { "retry-after": "0" } });
      }
      return new Response('{"ok":true}', { status: 200 });
    });

    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const res = await fetchWithRetry("https://example.com", { method: "GET" });
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.length).toBe(2);
  });
});
