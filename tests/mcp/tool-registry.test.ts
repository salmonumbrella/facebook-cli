import { describe, expect, it } from "bun:test";
import { registerBusinessTools } from "../../src/tools/business-tools.js";
import { registerInstagramTools } from "../../src/tools/instagram-tools.js";
import { registerWhatsappTools } from "../../src/tools/whatsapp-tools.js";
import { registerPagesPlusTools } from "../../src/tools/pages-plus-tools.js";
import { registerAuthTools } from "../../src/tools/auth-tools.js";

describe("tool registry", () => {
  it("registers new business/social/auth tool names", () => {
    const names: string[] = [];
    const fakeServer = {
      tool(name: string) {
        names.push(name);
      },
    };
    const deps = {
      graphApi: async () => ({}),
    };

    registerBusinessTools(fakeServer as any, deps);
    registerInstagramTools(fakeServer as any, deps);
    registerWhatsappTools(fakeServer as any, deps);
    registerPagesPlusTools(fakeServer as any, deps);
    registerAuthTools(fakeServer as any, deps);

    expect(names).toContain("business_info");
    expect(names).toContain("invoices_list");
    expect(names).toContain("ad_library_search");
    expect(names).toContain("ig_accounts_list");
    expect(names).toContain("ig_publish");
    expect(names).toContain("wa_send");
    expect(names).toContain("wa_templates_create");
    expect(names).toContain("page_insights_metric");
    expect(names).toContain("me");
    expect(names).toContain("auth_status");
    expect(names).toContain("profile_switch");
  });
});
