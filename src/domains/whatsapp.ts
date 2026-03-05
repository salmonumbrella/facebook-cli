export interface Deps {
  graphApi: (
    method: string,
    endpoint: string,
    token: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>,
  ) => Promise<any>;
}

export const sendWaMessage = (
  deps: Deps,
  phoneNumberId: string,
  token: string,
  to: string,
  text: string,
) =>
  deps.graphApi("POST", `${phoneNumberId}/messages`, token, undefined, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });

export const listWaTemplates = (
  deps: Deps,
  wabaId: string,
  token: string,
  params?: Record<string, string>,
) => deps.graphApi("GET", `${wabaId}/message_templates`, token, params);

export const createWaTemplate = (
  deps: Deps,
  wabaId: string,
  token: string,
  payload: Record<string, unknown>,
) => deps.graphApi("POST", `${wabaId}/message_templates`, token, undefined, payload);

export const listWaPhoneNumbers = (
  deps: Deps,
  wabaId: string,
  token: string,
  params?: Record<string, string>,
) => deps.graphApi("GET", `${wabaId}/phone_numbers`, token, params);
