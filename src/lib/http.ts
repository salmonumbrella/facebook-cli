export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;

    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      const retryAfterRaw = res.headers.get("retry-after") || "0";
      const retryAfter = Number(retryAfterRaw);
      const backoffMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
      await Bun.sleep(backoffMs);
      continue;
    }

    return res;
  }

  throw new Error("retry loop exhausted");
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
  };
}
