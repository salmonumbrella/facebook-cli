import { z } from "zod";
import {
  createWaTemplate,
  listWaPhoneNumbers,
  listWaTemplates,
  sendWaMessage,
} from "../domains/whatsapp.js";
import { json, parseObject, type GraphFn, type ToolServerLike } from "./shared.js";

export interface WhatsappToolDeps {
  graphApi: GraphFn;
}

export function registerWhatsappTools(server: ToolServerLike, deps: WhatsappToolDeps): void {
  const domainDeps = { graphApi: deps.graphApi };

  server.tool(
    "wa_send",
    "Send a WhatsApp message.",
    {
      phone_number_id: z.string(),
      access_token: z.string(),
      to: z.string(),
      text: z.string(),
    },
    async ({ phone_number_id, access_token, to, text }) => {
      return json(
        await sendWaMessage(
          domainDeps,
          String(phone_number_id),
          String(access_token),
          String(to),
          String(text),
        ),
      );
    },
  );

  server.tool(
    "wa_templates_list",
    "List WhatsApp templates.",
    { waba_id: z.string(), access_token: z.string() },
    async ({ waba_id, access_token }) => {
      return json(await listWaTemplates(domainDeps, String(waba_id), String(access_token)));
    },
  );

  server.tool(
    "wa_templates_create",
    "Create a WhatsApp template.",
    { waba_id: z.string(), access_token: z.string(), payload_json: z.string().optional() },
    async ({ waba_id, access_token, payload_json }) => {
      return json(
        await createWaTemplate(
          domainDeps,
          String(waba_id),
          String(access_token),
          parseObject(payload_json ? String(payload_json) : undefined),
        ),
      );
    },
  );

  server.tool(
    "wa_phone_numbers_list",
    "List WhatsApp phone numbers in a WABA.",
    { waba_id: z.string(), access_token: z.string() },
    async ({ waba_id, access_token }) => {
      return json(await listWaPhoneNumbers(domainDeps, String(waba_id), String(access_token)));
    },
  );
}
