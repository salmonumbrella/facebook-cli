import { describe, expect, it, mock } from "bun:test";
import { listInvoices } from "../../src/domains/business.js";

describe("business domain", () => {
  it("calls /{business_id}/business_invoices", async () => {
    const graphApi = mock(async () => ({ data: [] }));
    await listInvoices({ graphApi } as any, "biz_1", "TOKEN", "2026-02-01", "2026-02-28");
    expect(graphApi.mock.calls[0][1]).toBe("biz_1/business_invoices");
  });
});
