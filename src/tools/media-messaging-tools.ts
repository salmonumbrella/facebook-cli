import { z } from "zod";
import { getPage, type CoreToolDeps } from "./runtime.js";
import { json, type ToolServerLike } from "./shared.js";

export function registerMediaMessagingTools(server: ToolServerLike, deps: CoreToolDeps): void {
  server.tool(
    "send_dm_to_user",
    "Send a direct message to a user.\nInput: page_name (str), user_id (str), message (str)\nOutput: dict of result from Messenger API",
    { page_name: z.string(), user_id: z.string(), message: z.string() },
    async ({ page_name, user_id, message }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("POST", "me/messages", page.page_access_token, undefined, {
          recipient: { id: String(user_id) },
          message: { text: String(message) },
          messaging_type: "RESPONSE",
        }),
      );
    },
  );
}
