import { z } from "zod";
import { createWaTemplate, listWaPhoneNumbers, listWaTemplates, sendWaMessage } from "../domains/whatsapp.js";

type GraphFn = (
  method: string,
  endpoint: string,
  token: string,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
) => Promise<any>;

interface ToolServerLike {
  tool: (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: Record<string, unknown>) => Promise<any>,
  ) => void;
}

export interface WhatsappToolDeps {
  graphApi: GraphFn;
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function parseObject(input?: string): Record<string, unknown> {
  if (!input) return {};
  const parsed = JSON.parse(input);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
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
