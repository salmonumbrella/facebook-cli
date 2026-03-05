import {
  getBusinessInfo,
  listBusinessAdAccounts,
  listInvoices,
  downloadInvoicePdf,
  searchAdLibrary,
} from "../../src/domains/business.js";
import { graphApi } from "../../src/api.js";
import type { RuntimeContext } from "../lib/context.js";

const deps = { graphApi };

function requireToken(runtime: RuntimeContext): string {
  if (!runtime.accessToken) throw new Error("Missing access token. Use --access-token or profile/env token.");
  return runtime.accessToken;
}

export async function handleBusinessCommand(args: string[], runtime: RuntimeContext): Promise<unknown> {
  const [sub, ...rest] = args;
  if (!sub) throw new Error("Usage: fbcli business <info|ad-accounts> ...");
  if (runtime.dryRun) return { ok: true, route: `business ${sub}` };
  const token = requireToken(runtime);

  if (sub === "info") return getBusinessInfo(deps, rest[0] ?? "", token);
  if (sub === "ad-accounts") return listBusinessAdAccounts(deps, rest[0] ?? "", token);
  throw new Error("Usage: fbcli business <info|ad-accounts> <business-id>");
}

export async function handleInvoicesCommand(args: string[], runtime: RuntimeContext): Promise<unknown> {
  const [sub, ...rest] = args;
  if (!sub) throw new Error("Usage: fbcli invoices <list|download> ...");
  if (runtime.dryRun) return { ok: true, route: `invoices ${sub}` };
  const token = requireToken(runtime);

  if (sub === "list") {
    const [businessId, since, until] = rest;
    return listInvoices(deps, businessId ?? "", token, since, until);
  }
  if (sub === "download") {
    return {
      bytes: (await downloadInvoicePdf(deps, rest[0] ?? "", token)).byteLength,
      invoiceId: rest[0] ?? "",
    };
  }
  throw new Error("Usage: fbcli invoices <list|download> ...");
}

export async function handleAdLibraryCommand(args: string[], runtime: RuntimeContext): Promise<unknown> {
  const [sub, ...rest] = args;
  if (sub !== "search") throw new Error("Usage: fbcli ad-library search <query>");
  if (runtime.dryRun) return { ok: true, route: "ad-library search" };
  const token = requireToken(runtime);
  return searchAdLibrary(deps, token, { search_terms: rest[0] ?? "", ad_reached_countries: "US" });
}
