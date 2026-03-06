const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

const DEFAULTS = {
  maxRateLimitRetries: 4,
  maxServerRetries: 2,
  retryBaseDelayMs: 500,
  retryMaxDelayMs: 10_000,
  retryJitterRatio: 0.2,
  circuitBreakerEnabled: true,
  circuitFailureThreshold: 5,
  circuitCooldownMs: 30_000,
  circuitHalfOpenSuccesses: 1,
  globalMinIntervalMs: 50,
  tokenMinIntervalMs: 150,
};

export interface FetchWithRetryOptions {
  maxRetries?: number;
  maxRateLimitRetries?: number;
  maxServerRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  retryJitterRatio?: number;
  breakerEnabled?: boolean;
  breakerFailureThreshold?: number;
  breakerCooldownMs?: number;
  breakerHalfOpenSuccesses?: number;
  breakerKey?: string;
  tokenKey?: string;
  globalMinIntervalMs?: number;
  tokenMinIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

interface ResolvedFetchOptions {
  maxRateLimitRetries: number;
  maxServerRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  retryJitterRatio: number;
  breakerEnabled: boolean;
  breakerFailureThreshold: number;
  breakerCooldownMs: number;
  breakerHalfOpenSuccesses: number;
  breakerKey: string;
  tokenKey?: string;
  globalMinIntervalMs: number;
  tokenMinIntervalMs: number;
  fetchImpl: typeof fetch;
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  return fallback;
}

function readNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function readRatio(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 1);
}

function hasIdempotencyKey(headers?: HeadersInit): boolean {
  if (!headers) return false;
  const key = "idempotency-key";
  if (headers instanceof Headers) {
    return headers.has(key);
  }
  if (Array.isArray(headers)) {
    return headers.some(([name]) => name.toLowerCase() === key);
  }
  return Object.keys(headers).some((name) => name.toLowerCase() === key);
}

function normalizeMethod(method?: string): string {
  return (method ?? "GET").toUpperCase();
}

function isReplaySafeRequest(init: RequestInit): boolean {
  const method = normalizeMethod(init.method);
  return IDEMPOTENT_METHODS.has(method) || hasIdempotencyKey(init.headers);
}

function computeBackoffMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterRatio: number,
): number {
  const capped = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  if (jitterRatio <= 0) return Math.max(0, Math.round(capped));
  const jitterSpan = capped * jitterRatio;
  const jitter = (Math.random() * 2 - 1) * jitterSpan;
  return Math.max(0, Math.round(capped + jitter));
}

export function parseRetryAfterHeader(
  value: string | null | undefined,
  nowMs = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.max(0, Math.floor(asSeconds * 1000));
  }

  const asDateMs = Date.parse(trimmed);
  if (Number.isNaN(asDateMs)) return undefined;
  return Math.max(0, asDateMs - nowMs);
}

function normalizeOptions(
  optionsOrMaxRetries?: number | FetchWithRetryOptions,
): ResolvedFetchOptions {
  const input =
    typeof optionsOrMaxRetries === "number"
      ? ({ maxRetries: optionsOrMaxRetries } satisfies FetchWithRetryOptions)
      : (optionsOrMaxRetries ?? {});

  const env = process.env;
  const envMaxRateLimitRetries = readNonNegativeInt(
    env.FB_HTTP_MAX_RATE_LIMIT_RETRIES,
    DEFAULTS.maxRateLimitRetries,
  );
  const envMaxServerRetries = readNonNegativeInt(
    env.FB_HTTP_MAX_SERVER_RETRIES,
    DEFAULTS.maxServerRetries,
  );

  const maxRateLimitRetries =
    input.maxRetries !== undefined
      ? Math.max(0, Math.floor(input.maxRetries))
      : (input.maxRateLimitRetries ?? envMaxRateLimitRetries);
  const maxServerRetries =
    input.maxRetries !== undefined
      ? Math.max(0, Math.floor(input.maxRetries))
      : (input.maxServerRetries ?? envMaxServerRetries);

  return {
    maxRateLimitRetries,
    maxServerRetries,
    retryBaseDelayMs:
      input.retryBaseDelayMs ??
      readNonNegativeInt(env.FB_HTTP_RETRY_BASE_DELAY_MS, DEFAULTS.retryBaseDelayMs),
    retryMaxDelayMs:
      input.retryMaxDelayMs ??
      readNonNegativeInt(env.FB_HTTP_RETRY_MAX_DELAY_MS, DEFAULTS.retryMaxDelayMs),
    retryJitterRatio:
      input.retryJitterRatio ??
      readRatio(env.FB_HTTP_RETRY_JITTER_RATIO, DEFAULTS.retryJitterRatio),
    breakerEnabled:
      input.breakerEnabled ??
      readBool(env.FB_HTTP_CIRCUIT_BREAKER_ENABLED, DEFAULTS.circuitBreakerEnabled),
    breakerFailureThreshold:
      input.breakerFailureThreshold ??
      readNonNegativeInt(env.FB_HTTP_CIRCUIT_FAILURE_THRESHOLD, DEFAULTS.circuitFailureThreshold),
    breakerCooldownMs:
      input.breakerCooldownMs ??
      readNonNegativeInt(env.FB_HTTP_CIRCUIT_COOLDOWN_MS, DEFAULTS.circuitCooldownMs),
    breakerHalfOpenSuccesses:
      input.breakerHalfOpenSuccesses ??
      readNonNegativeInt(
        env.FB_HTTP_CIRCUIT_HALF_OPEN_SUCCESSES,
        DEFAULTS.circuitHalfOpenSuccesses,
      ),
    breakerKey: input.breakerKey ?? "default",
    tokenKey: input.tokenKey,
    globalMinIntervalMs:
      input.globalMinIntervalMs ??
      readNonNegativeInt(env.FB_HTTP_GLOBAL_MIN_INTERVAL_MS, DEFAULTS.globalMinIntervalMs),
    tokenMinIntervalMs:
      input.tokenMinIntervalMs ??
      readNonNegativeInt(env.FB_HTTP_TOKEN_MIN_INTERVAL_MS, DEFAULTS.tokenMinIntervalMs),
    fetchImpl: input.fetchImpl ?? fetch,
  };
}

async function sleepMs(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) throw new Error("Request aborted");

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Request aborted"));
    };

    const cleanup = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

class RequestPacer {
  private globalLastAtMs = 0;
  private lastAtByToken = new Map<string, number>();
  private pending = Promise.resolve();

  async wait(
    globalMinIntervalMs: number,
    tokenMinIntervalMs: number,
    tokenKey?: string,
    signal?: AbortSignal | null,
  ): Promise<void> {
    const previous = this.pending;
    let release!: () => void;
    this.pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      const now = Date.now();
      let waitMs = 0;

      if (globalMinIntervalMs > 0) {
        waitMs = Math.max(waitMs, this.globalLastAtMs + globalMinIntervalMs - now);
      }

      if (tokenKey && tokenMinIntervalMs > 0) {
        const tokenLast = this.lastAtByToken.get(tokenKey) ?? 0;
        waitMs = Math.max(waitMs, tokenLast + tokenMinIntervalMs - now);
      }

      if (waitMs > 0) {
        await sleepMs(waitMs, signal);
      }

      const markAt = Date.now();
      this.globalLastAtMs = markAt;
      if (tokenKey) this.lastAtByToken.set(tokenKey, markAt);
    } finally {
      release();
    }
  }

  reset(): void {
    this.globalLastAtMs = 0;
    this.lastAtByToken.clear();
    this.pending = Promise.resolve();
  }
}

type BreakerState = "closed" | "open" | "half_open";

class CircuitBreaker {
  private state: BreakerState = "closed";
  private consecutiveFailures = 0;
  private openedAtMs = 0;
  private halfOpenSuccesses = 0;

  constructor(
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
    private readonly halfOpenSuccessesRequired: number,
  ) {}

  canRequest(nowMs = Date.now()): boolean {
    if (this.state !== "open") return true;
    if (nowMs - this.openedAtMs < this.cooldownMs) {
      return false;
    }
    this.state = "half_open";
    this.halfOpenSuccesses = 0;
    return true;
  }

  recordSuccess(): void {
    if (this.state === "half_open") {
      this.halfOpenSuccesses += 1;
      if (this.halfOpenSuccesses >= this.halfOpenSuccessesRequired) {
        this.state = "closed";
        this.consecutiveFailures = 0;
        this.halfOpenSuccesses = 0;
      }
      return;
    }

    if (this.state === "closed") {
      this.consecutiveFailures = 0;
    }
  }

  recordFailure(nowMs = Date.now()): void {
    if (this.state === "half_open") {
      this.open(nowMs);
      return;
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.open(nowMs);
    }
  }

  retryAfterMs(nowMs = Date.now()): number {
    if (this.state !== "open") return 0;
    return Math.max(0, this.cooldownMs - (nowMs - this.openedAtMs));
  }

  reset(): void {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.openedAtMs = 0;
    this.halfOpenSuccesses = 0;
  }

  private open(nowMs: number): void {
    this.state = "open";
    this.openedAtMs = nowMs;
    this.consecutiveFailures = this.failureThreshold;
    this.halfOpenSuccesses = 0;
  }
}

const requestPacer = new RequestPacer();
const breakers = new Map<string, CircuitBreaker>();

function hashKey(value: string): string {
  let hash = 2_169_136_261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function breakerScopeKey(options: ResolvedFetchOptions): string {
  if (!options.tokenKey) return options.breakerKey;
  return `${options.breakerKey}:${hashKey(options.tokenKey)}`;
}

function getBreaker(scopeKey: string, options: ResolvedFetchOptions): CircuitBreaker {
  const existing = breakers.get(scopeKey);
  if (existing) return existing;

  const breaker = new CircuitBreaker(
    Math.max(1, options.breakerFailureThreshold),
    options.breakerCooldownMs,
    Math.max(1, options.breakerHalfOpenSuccesses),
  );
  breakers.set(scopeKey, breaker);
  return breaker;
}

export class CircuitBreakerOpenError extends Error {
  readonly breakerKey: string;
  readonly retryAfterMs: number;

  constructor(breakerKey: string, retryAfterMs: number) {
    super(
      `Circuit breaker '${breakerKey}' is open. Retry after approximately ${Math.ceil(
        retryAfterMs / 1000,
      )}s.`,
    );
    this.name = "CircuitBreakerOpenError";
    this.breakerKey = breakerKey;
    this.retryAfterMs = retryAfterMs;
  }
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  optionsOrMaxRetries?: number | FetchWithRetryOptions,
): Promise<Response> {
  const options = normalizeOptions(optionsOrMaxRetries);
  const replaySafe = isReplaySafeRequest(init);
  const signal = init.signal;
  const breaker = getBreaker(breakerScopeKey(options), options);
  let rateLimitRetries = 0;
  let serverRetries = 0;

  while (true) {
    if (options.breakerEnabled && !breaker.canRequest()) {
      throw new CircuitBreakerOpenError(options.breakerKey, breaker.retryAfterMs());
    }

    await requestPacer.wait(
      options.globalMinIntervalMs,
      options.tokenMinIntervalMs,
      options.tokenKey,
      signal,
    );

    let res: Response;
    try {
      res = await options.fetchImpl(url, init);
    } catch (error) {
      if (options.breakerEnabled) breaker.recordFailure();
      if (!replaySafe || serverRetries >= options.maxServerRetries) {
        throw error;
      }
      const delayMs = computeBackoffMs(
        serverRetries,
        options.retryBaseDelayMs,
        options.retryMaxDelayMs,
        options.retryJitterRatio,
      );
      serverRetries += 1;
      await sleepMs(delayMs, signal);
      continue;
    }

    if (res.ok) {
      if (options.breakerEnabled) breaker.recordSuccess();
      return res;
    }

    if (res.status === 429 && rateLimitRetries < options.maxRateLimitRetries) {
      const retryAfterMs = parseRetryAfterHeader(res.headers.get("retry-after"));
      const delayMs =
        retryAfterMs ??
        computeBackoffMs(
          rateLimitRetries,
          options.retryBaseDelayMs,
          options.retryMaxDelayMs,
          options.retryJitterRatio,
        );
      rateLimitRetries += 1;
      await sleepMs(delayMs, signal);
      continue;
    }

    if (res.status >= 500) {
      if (options.breakerEnabled) breaker.recordFailure();
      if (replaySafe && serverRetries < options.maxServerRetries) {
        const retryAfterMs = parseRetryAfterHeader(res.headers.get("retry-after"));
        const delayMs =
          retryAfterMs ??
          computeBackoffMs(
            serverRetries,
            options.retryBaseDelayMs,
            options.retryMaxDelayMs,
            options.retryJitterRatio,
          );
        serverRetries += 1;
        await sleepMs(delayMs, signal);
        continue;
      }
    } else if (options.breakerEnabled) {
      // A non-5xx response indicates the upstream is reachable.
      breaker.recordSuccess();
    }

    return res;
  }
}

function tryParseJson(value: string | null): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function parseRateLimitHeaders(headers: Headers) {
  return {
    appUsage: tryParseJson(headers.get("x-app-usage")),
    businessUsage: tryParseJson(headers.get("x-business-use-case-usage")),
    adAccountUsage: tryParseJson(headers.get("x-ad-account-usage")),
  };
}

export function __resetHttpResilienceStateForTests(): void {
  requestPacer.reset();
  for (const breaker of breakers.values()) {
    breaker.reset();
  }
  breakers.clear();
}
