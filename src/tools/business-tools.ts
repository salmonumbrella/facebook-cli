import { z } from "zod";
import {
  downloadInvoicePdf,
  getBusinessInfo,
  listBusinessAdAccounts,
  listInvoices,
  searchAdLibrary,
} from "../domains/business.js";
import { json, parseObject, type GraphFn, type ToolServerLike } from "./shared.js";

export interface BusinessToolDeps {
  graphApi: GraphFn;
}

export function registerBusinessTools(server: ToolServerLike, deps: BusinessToolDeps): void {
  const domainDeps = { graphApi: deps.graphApi };

  server.tool(
    "business_info",
    "Get Business Manager details.",
    { business_id: z.string(), access_token: z.string(), params_json: z.string().optional() },
    async ({ business_id, access_token, params_json }) => {
      return json(
        await getBusinessInfo(
          domainDeps,
          String(business_id),
          String(access_token),
          parseObject(params_json ? String(params_json) : undefined),
        ),
      );
    },
  );

  server.tool(
    "business_ad_accounts",
    "List ad accounts owned by a business.",
    { business_id: z.string(), access_token: z.string(), params_json: z.string().optional() },
    async ({ business_id, access_token, params_json }) => {
      return json(
        await listBusinessAdAccounts(
          domainDeps,
          String(business_id),
          String(access_token),
          parseObject(params_json ? String(params_json) : undefined),
        ),
      );
    },
  );

  server.tool(
    "invoices_list",
    "List business invoices for a date range.",
    {
      business_id: z.string(),
      access_token: z.string(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      params_json: z.string().optional(),
    },
    async ({ business_id, access_token, start_date, end_date, params_json }) => {
      return json(
        await listInvoices(
          domainDeps,
          String(business_id),
          String(access_token),
          start_date ? String(start_date) : undefined,
          end_date ? String(end_date) : undefined,
          parseObject(params_json ? String(params_json) : undefined),
        ),
      );
    },
  );

  server.tool(
    "invoices_download",
    "Download invoice PDF metadata.",
    { invoice_id: z.string(), access_token: z.string() },
    async ({ invoice_id, access_token }) => {
      const data = await downloadInvoicePdf(domainDeps, String(invoice_id), String(access_token));
      return json({ ok: true, bytes: data.byteLength });
    },
  );

  server.tool(
    "ad_library_search",
    "Search Meta Ad Library.",
    { access_token: z.string(), params_json: z.string() },
    async ({ access_token, params_json }) => {
      return json(
        await searchAdLibrary(domainDeps, String(access_token), parseObject(String(params_json))),
      );
    },
  );
}
