import { describe, expect, it, mock } from "bun:test";
import { sendWaMessage } from "../../src/domains/whatsapp.js";

describe("whatsapp domain", () => {
  it("posts to /messages", async () => {
    const graphApi = mock(async () => ({ messages: [{ id: "wamid" }] }));
    await sendWaMessage({ graphApi } as any, "pnid", "TOKEN", "+15550001111", "hello");
    expect(graphApi.mock.calls[0][1]).toBe("pnid/messages");
  });
});
