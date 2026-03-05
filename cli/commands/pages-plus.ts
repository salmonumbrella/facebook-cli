import {
  getPageInsightsMetric,
  uploadLocalPhoto,
  createDraftPost,
  getMe,
} from "../../src/domains/pages-plus.js";
import { graphApi } from "../../src/api.js";
import type { RuntimeContext } from "../lib/context.js";

const deps = { graphApi };

function requireToken(runtime: RuntimeContext): string {
  if (!runtime.accessToken) throw new Error("Missing access token. Use --access-token or profile/env token.");
  return runtime.accessToken;
}

export async function handlePagesPlusCommand(command: string, args: string[], runtime: RuntimeContext): Promise<unknown> {
  if (runtime.dryRun) return { ok: true, route: `${command}${args.length ? ` ${args.join(" ")}` : ""}` };
  const token = requireToken(runtime);

  if (command === "page-insights") {
    const metric = args[0] && !["fans", "reach", "views", "engagement"].includes(args[0]) ? args[0] : undefined;
    const pageId = metric ? args[1] : args[0];
    const alias = args[0];
    const resolvedMetric =
      metric ??
      (alias === "fans"
        ? "page_fans"
        : alias === "reach"
          ? "page_impressions_unique"
          : alias === "views"
            ? "page_views_total"
            : alias === "engagement"
              ? "page_engaged_users"
              : "page_fans");
    return getPageInsightsMetric(deps, pageId ?? "", token, resolvedMetric, "day");
  }

  if (command === "post-local") {
    return uploadLocalPhoto(deps, args[0] ?? "", token, args[1] ?? "", args.slice(2).join(" "));
  }

  if (command === "draft") {
    return createDraftPost(deps, args[0] ?? "", token, args.slice(1).join(" "));
  }

  if (command === "me") {
    return getMe(deps, token);
  }

  throw new Error("Usage: fbcli <page-insights|post-local|draft|me> ...");
}
