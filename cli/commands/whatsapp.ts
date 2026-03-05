import {
  sendWaMessage,
  listWaTemplates,
  createWaTemplate,
  listWaPhoneNumbers,
} from "../../src/domains/whatsapp.js";
import { graphApi } from "../../src/api.js";
import type { RuntimeContext } from "../lib/context.js";

const deps = { graphApi };

function requireToken(runtime: RuntimeContext): string {
  if (!runtime.accessToken)
    throw new Error("Missing access token. Use --access-token or profile/env token.");
  return runtime.accessToken;
}

export async function handleWhatsappCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<unknown> {
  const [group, action, ...rest] = args;
  if (!group) throw new Error("Usage: fbcli wa <send|templates|phone-numbers> ...");
  if (runtime.dryRun) return { ok: true, route: `wa ${group}${action ? ` ${action}` : ""}` };
  const token = requireToken(runtime);

  if (group === "send") {
    const [phoneNumberId, to, ...message] = [action, ...rest];
    return sendWaMessage(deps, phoneNumberId ?? "", token, to ?? "", message.join(" "));
  }

  if (group === "templates" && action === "list")
    return listWaTemplates(deps, rest[0] ?? "", token);
  if (group === "templates" && action === "create")
    return createWaTemplate(deps, rest[0] ?? "", token, JSON.parse(rest[1] ?? "{}"));
  if (group === "phone-numbers" && action === "list")
    return listWaPhoneNumbers(deps, rest[0] ?? "", token);

  throw new Error("Usage: fbcli wa <send|templates|phone-numbers> ...");
}
