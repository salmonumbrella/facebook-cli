import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  __resetHttpResilienceStateForTests,
  CircuitBreakerOpenError,
  fetchWithRetry,
  parseRetryAfterHeader,
} from "../../src/lib/http.js";

const originalFetch = globalThis.fetch;

const fastOptions = {
  retryBaseDelayMs: 0,
  retryMaxDelayMs: 0,
  retryJitterRatio: 0,
  globalMinIntervalMs: 0,
  tokenMinIntervalMs: 0,
};

afterEach(() => {
  __resetHttpResilienceStateForTests();
  // @ts-expect-error test override
  globalThis.fetch = originalFetch;
});

describe("parseRetryAfterHeader", () => {
  it("parses delta seconds and HTTP-date", () => {
    const now = Date.parse("2026-03-04T00:00:00.000Z");
    expect(parseRetryAfterHeader("2", now)).toBe(2000);
    expect(parseRetryAfterHeader(new Date(now + 3000).toUTCString(), now)).toBe(3000);
    expect(parseRetryAfterHeader("invalid", now)).toBeUndefined();
  });
});

describe("fetchWithRetry", () => {
  it("retries 429 and then succeeds, including for POST", async () => {
    const fetchMock = mock(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return new Response("{}", { status: 429, headers: { "retry-after": "0" } });
      }
      return new Response('{"ok":true}', { status: 200 });
    });
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const res = await fetchWithRetry(
      "https://example.com",
      { method: "POST" },
      { ...fastOptions, maxRateLimitRetries: 1, maxServerRetries: 0, breakerEnabled: false },
    );
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it("does not retry POST 5xx without idempotency key", async () => {
    const fetchMock = mock(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return new Response("{}", { status: 500 });
      }
      return new Response('{"ok":true}', { status: 200 });
    });
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const res = await fetchWithRetry(
      "https://example.com",
      { method: "POST" },
      { ...fastOptions, maxServerRetries: 2, breakerEnabled: false },
    );
    expect(res.status).toBe(500);
    expect(fetchMock.mock.calls.length).toBe(1);
  });

  it("retries GET 5xx and eventually succeeds", async () => {
    const fetchMock = mock(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return new Response("{}", { status: 503 });
      }
      return new Response('{"ok":true}', { status: 200 });
    });
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const res = await fetchWithRetry(
      "https://example.com",
      { method: "GET" },
      { ...fastOptions, maxServerRetries: 1, breakerEnabled: false },
    );
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it("retries POST 5xx when idempotency key is present", async () => {
    const fetchMock = mock(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return new Response("{}", { status: 502 });
      }
      return new Response('{"ok":true}', { status: 200 });
    });
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const res = await fetchWithRetry(
      "https://example.com",
      {
        method: "POST",
        headers: {
          "Idempotency-Key": "test-idempotency-key",
        },
      },
      { ...fastOptions, maxServerRetries: 1, breakerEnabled: false },
    );
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it("opens circuit breaker after repeated 5xx failures", async () => {
    const fetchMock = mock(async () => new Response("{}", { status: 503 }));
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const options = {
      ...fastOptions,
      maxServerRetries: 0,
      maxRateLimitRetries: 0,
      breakerEnabled: true,
      breakerKey: "test-breaker",
      breakerFailureThreshold: 2,
      breakerCooldownMs: 60_000,
    };

    const first = await fetchWithRetry("https://example.com", { method: "GET" }, options);
    expect(first.status).toBe(503);
    const second = await fetchWithRetry("https://example.com", { method: "GET" }, options);
    expect(second.status).toBe(503);
    await expect(
      fetchWithRetry("https://example.com", { method: "GET" }, options),
    ).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it("isolates circuit breaker state across different token keys", async () => {
    const fetchMock = mock(async (url: string | URL) => {
      if (String(url).includes("token-a")) {
        return new Response("{}", { status: 503 });
      }
      return new Response('{"ok":true}', { status: 200 });
    });
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const shared = {
      ...fastOptions,
      maxServerRetries: 0,
      maxRateLimitRetries: 0,
      breakerEnabled: true,
      breakerKey: "graph_read",
      breakerFailureThreshold: 1,
      breakerCooldownMs: 60_000,
    };

    const tokenARes = await fetchWithRetry(
      "https://example.com/resource?token=token-a",
      { method: "GET" },
      { ...shared, tokenKey: "token-a" },
    );
    expect(tokenARes.status).toBe(503);

    const tokenBRes = await fetchWithRetry(
      "https://example.com/resource?token=token-b",
      { method: "GET" },
      { ...shared, tokenKey: "token-b" },
    );
    expect(tokenBRes.status).toBe(200);

    await expect(
      fetchWithRetry(
        "https://example.com/resource?token=token-a",
        { method: "GET" },
        { ...shared, tokenKey: "token-a" },
      ),
    ).rejects.toBeInstanceOf(CircuitBreakerOpenError);

    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it("allows requests again after breaker cooldown and closes on half-open success", async () => {
    const fetchMock = mock(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return new Response("{}", { status: 503 });
      }
      return new Response('{"ok":true}', { status: 200 });
    });
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const originalNow = Date.now;
    let nowMs = 0;
    Date.now = () => nowMs;

    try {
      const options = {
        ...fastOptions,
        maxServerRetries: 0,
        maxRateLimitRetries: 0,
        breakerEnabled: true,
        breakerKey: "cooldown-breaker",
        breakerFailureThreshold: 1,
        breakerCooldownMs: 1_000,
        breakerHalfOpenSuccesses: 1,
      };

      const first = await fetchWithRetry("https://example.com", { method: "GET" }, options);
      expect(first.status).toBe(503);

      nowMs = 500;
      await expect(
        fetchWithRetry("https://example.com", { method: "GET" }, options),
      ).rejects.toBeInstanceOf(CircuitBreakerOpenError);

      nowMs = 1_001;
      const halfOpen = await fetchWithRetry("https://example.com", { method: "GET" }, options);
      expect(halfOpen.status).toBe(200);

      nowMs = 1_010;
      const afterClose = await fetchWithRetry("https://example.com", { method: "GET" }, options);
      expect(afterClose.status).toBe(200);
      expect(fetchMock.mock.calls.length).toBe(3);
    } finally {
      Date.now = originalNow;
    }
  });

  it("paces concurrent requests against the same token key", async () => {
    const callTimes: number[] = [];
    const fetchMock = mock(async () => {
      callTimes.push(Date.now());
      return new Response('{"ok":true}', { status: 200 });
    });
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    await Promise.all([
      fetchWithRetry(
        "https://example.com/a",
        { method: "GET" },
        {
          ...fastOptions,
          globalMinIntervalMs: 20,
          tokenMinIntervalMs: 20,
          breakerEnabled: false,
          tokenKey: "token-a",
        },
      ),
      fetchWithRetry(
        "https://example.com/b",
        { method: "GET" },
        {
          ...fastOptions,
          globalMinIntervalMs: 20,
          tokenMinIntervalMs: 20,
          breakerEnabled: false,
          tokenKey: "token-a",
        },
      ),
      fetchWithRetry(
        "https://example.com/c",
        { method: "GET" },
        {
          ...fastOptions,
          globalMinIntervalMs: 20,
          tokenMinIntervalMs: 20,
          breakerEnabled: false,
          tokenKey: "token-a",
        },
      ),
    ]);

    expect(callTimes.length).toBe(3);
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(15);
    expect(callTimes[2] - callTimes[1]).toBeGreaterThanOrEqual(15);
  });
});
