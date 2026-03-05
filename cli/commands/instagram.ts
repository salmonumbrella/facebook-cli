import {
  listIgAccounts,
  listIgMedia,
  getIgMediaInsights,
  getIgAccountInsights,
  listIgComments,
  replyIgComment,
  publishIgMedia,
  listIgStories,
} from "../../src/domains/instagram.js";
import { graphApi } from "../../src/api.js";
import type { RuntimeContext } from "../lib/context.js";

const deps = { graphApi };

function requireToken(runtime: RuntimeContext): string {
  if (!runtime.accessToken)
    throw new Error("Missing access token. Use --access-token or profile/env token.");
  return runtime.accessToken;
}

export async function handleInstagramCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<unknown> {
  const [group, action, ...rest] = args;
  if (!group)
    throw new Error("Usage: fbcli ig <accounts|media|account|comments|publish|stories> ...");
  if (runtime.dryRun) return { ok: true, route: `ig ${group}${action ? ` ${action}` : ""}` };
  const token = requireToken(runtime);

  if (group === "accounts" && action === "list") return listIgAccounts(deps, token);
  if (group === "media" && action === "list") return listIgMedia(deps, rest[0] ?? "", token);
  if (group === "media" && action === "insights")
    return getIgMediaInsights(deps, rest[0] ?? "", token);
  if (group === "account" && action === "insights")
    return getIgAccountInsights(deps, rest[0] ?? "", token);
  if (group === "comments" && action === "list") return listIgComments(deps, rest[0] ?? "", token);
  if (group === "comments" && action === "reply")
    return replyIgComment(deps, rest[0] ?? "", token, rest.slice(1).join(" ") || "");
  if (group === "publish")
    return publishIgMedia(deps, action ?? "", token, {
      image_url: rest[0],
      caption: rest.slice(1).join(" "),
    });
  if (group === "stories" && action === "list") return listIgStories(deps, rest[0] ?? "", token);

  throw new Error("Usage: fbcli ig <accounts|media|account|comments|publish|stories> ...");
}
