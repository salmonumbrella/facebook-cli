export interface Deps {
  graphApi: (
    method: string,
    endpoint: string,
    token: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>,
  ) => Promise<any>;
}

export const getBusinessInfo = (
  deps: Deps,
  businessId: string,
  token: string,
  params?: Record<string, string>,
) => deps.graphApi("GET", businessId, token, params);

export const listBusinessAdAccounts = (
  deps: Deps,
  businessId: string,
  token: string,
  params?: Record<string, string>,
) => deps.graphApi("GET", `${businessId}/owned_ad_accounts`, token, params);

export const listInvoices = (
  deps: Deps,
  businessId: string,
  token: string,
  startDate?: string,
  endDate?: string,
  params?: Record<string, string>,
) =>
  deps.graphApi("GET", `${businessId}/business_invoices`, token, {
    ...params,
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {}),
  });

export async function downloadInvoicePdf(
  deps: Deps,
  invoiceId: string,
  token: string,
): Promise<ArrayBuffer> {
  const invoice = await deps.graphApi("GET", invoiceId, token, { fields: "download_uri" });
  const uri = invoice?.download_uri;
  if (!uri) throw new Error("Invoice download_uri not available");

  const res = await fetch(String(uri));
  if (!res.ok) throw new Error(`Failed to download invoice PDF: ${res.status}`);
  return res.arrayBuffer();
}

export const searchAdLibrary = (deps: Deps, token: string, params: Record<string, string>) =>
  deps.graphApi("GET", "ads_archive", token, params);
