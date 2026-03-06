import { afterEach, describe, expect, it } from "bun:test";
import { graphApi } from "../../src/api.js";

const originalFetch = globalThis.fetch;
const originalApiVersion = process.env.FB_API_VERSION;

afterEach(() => {
  // @ts-expect-error test override
  globalThis.fetch = originalFetch;
  if (originalApiVersion === undefined) delete process.env.FB_API_VERSION;
  else process.env.FB_API_VERSION = originalApiVersion;
});

describe("graphApi", () => {
  it("uses the current FB_API_VERSION at call time", async () => {
    let calledUrl = "";
    // @ts-expect-error test override
    globalThis.fetch = async (url: string | URL) => {
      calledUrl = String(url);
      return new Response('{"ok":true}', { status: 200 });
    };

    process.env.FB_API_VERSION = "v99.0";
    await graphApi("GET", "me", "TOKEN", { fields: "id,name" });

    expect(calledUrl).toContain("https://graph.facebook.com/v99.0/me");
    expect(calledUrl).toContain("fields=id%2Cname");
  });

  it("serializes explicit mutation bodies as form fields instead of query params", async () => {
    let calledUrl = "";
    let calledInit: RequestInit | undefined;
    // @ts-expect-error test override
    globalThis.fetch = async (url: string | URL, init?: RequestInit) => {
      calledUrl = String(url);
      calledInit = init;
      return new Response('{"ok":true}', { status: 200 });
    };

    await graphApi("POST", "me/messages", "TOKEN", undefined, {
      recipient: { id: "123" },
      message: { text: "hello" },
      messaging_type: "RESPONSE",
    });

    expect(calledUrl).toBe("https://graph.facebook.com/v25.0/me/messages?access_token=TOKEN");
    expect(calledInit?.method).toBe("POST");
    const body = new URLSearchParams(String(calledInit?.body ?? ""));
    expect(body.get("recipient")).toBe('{"id":"123"}');
    expect(body.get("message")).toBe('{"text":"hello"}');
    expect(body.get("messaging_type")).toBe("RESPONSE");
  });

  it("treats legacy mutation params as a request body when body is omitted", async () => {
    let calledUrl = "";
    let calledInit: RequestInit | undefined;
    // @ts-expect-error test override
    globalThis.fetch = async (url: string | URL, init?: RequestInit) => {
      calledUrl = String(url);
      calledInit = init;
      return new Response('{"ok":true}', { status: 200 });
    };

    await graphApi("POST", "act_1/campaigns", "TOKEN", {
      name: "Campaign",
      status: "PAUSED",
    });

    expect(calledUrl).toBe("https://graph.facebook.com/v25.0/act_1/campaigns?access_token=TOKEN");
    const body = new URLSearchParams(String(calledInit?.body ?? ""));
    expect(body.get("name")).toBe("Campaign");
    expect(body.get("status")).toBe("PAUSED");
  });
});
