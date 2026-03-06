import { z } from "zod";
import {
  ALL_INSIGHT_METRICS,
  REACTION_METRICS,
  getInsight,
  getPage,
  type CoreToolDeps,
} from "./runtime.js";
import { json, type ToolServerLike } from "./shared.js";

const SINGLE_INSIGHT_TOOLS = [
  {
    description:
      "Fetch total impressions of a post.\nInput: page_name (str), post_id (str)\nOutput: dict with total impression count",
    metric: "post_impressions",
    name: "get_post_impressions",
  },
  {
    description:
      "Fetch unique impressions of a post.\nInput: page_name (str), post_id (str)\nOutput: dict with unique impression count",
    metric: "post_impressions_unique",
    name: "get_post_impressions_unique",
  },
  {
    description:
      "Fetch paid impressions of a post.\nInput: page_name (str), post_id (str)\nOutput: dict with paid impression count",
    metric: "post_impressions_paid",
    name: "get_post_impressions_paid",
  },
  {
    description:
      "Fetch organic impressions of a post.\nInput: page_name (str), post_id (str)\nOutput: dict with organic impression count",
    metric: "post_impressions_organic",
    name: "get_post_impressions_organic",
  },
  {
    description:
      "Fetch number of engaged users.\nInput: page_name (str), post_id (str)\nOutput: dict with engagement count",
    metric: "post_engaged_users",
    name: "get_post_engaged_users",
  },
  {
    description:
      "Fetch number of post clicks.\nInput: page_name (str), post_id (str)\nOutput: dict with click count",
    metric: "post_clicks",
    name: "get_post_clicks",
  },
  {
    description:
      "Fetch number of 'Like' reactions.\nInput: page_name (str), post_id (str)\nOutput: dict with like count",
    metric: "post_reactions_like_total",
    name: "get_post_reactions_like_total",
  },
  {
    description:
      "Fetch number of 'Love' reactions.\nInput: page_name (str), post_id (str)\nOutput: dict with love count",
    metric: "post_reactions_love_total",
    name: "get_post_reactions_love_total",
  },
  {
    description:
      "Fetch number of 'Wow' reactions.\nInput: page_name (str), post_id (str)\nOutput: dict with wow count",
    metric: "post_reactions_wow_total",
    name: "get_post_reactions_wow_total",
  },
  {
    description:
      "Fetch number of 'Haha' reactions.\nInput: page_name (str), post_id (str)\nOutput: dict with haha count",
    metric: "post_reactions_haha_total",
    name: "get_post_reactions_haha_total",
  },
  {
    description:
      "Fetch number of 'Sorry' reactions.\nInput: page_name (str), post_id (str)\nOutput: dict with sorry count",
    metric: "post_reactions_sorry_total",
    name: "get_post_reactions_sorry_total",
  },
  {
    description:
      "Fetch number of 'Anger' reactions.\nInput: page_name (str), post_id (str)\nOutput: dict with anger count",
    metric: "post_reactions_anger_total",
    name: "get_post_reactions_anger_total",
  },
] as const;

export function registerAnalyticsTools(server: ToolServerLike, deps: CoreToolDeps): void {
  server.tool(
    "get_number_of_comments",
    "Count the number of comments on a given post.\nInput: page_name (str), post_id (str)\nOutput: integer count of comments",
    { page_name: z.string(), post_id: z.string() },
    async ({ page_name, post_id }) => {
      const page = getPage(deps, String(page_name));
      const url = `${deps.getGraphApiBase()}/${String(post_id)}/comments?fields=id&access_token=${encodeURIComponent(page.page_access_token)}`;
      const allComments = await deps.paginateAll<{ id: string }>(url);
      return json({ comment_count: allComments.length });
    },
  );

  server.tool(
    "get_number_of_likes",
    "Return the number of likes on a post.\nInput: page_name (str), post_id (str)\nOutput: integer count of likes",
    { page_name: z.string(), post_id: z.string() },
    async ({ page_name, post_id }) => {
      const page = getPage(deps, String(page_name));
      const data = await deps.graphApi("GET", String(post_id), page.page_access_token, {
        fields: "likes.summary(true)",
      });
      return json({ likes: data.likes?.summary?.total_count ?? 0 });
    },
  );

  server.tool(
    "get_post_insights",
    "Fetch all insights metrics (impressions, reactions, clicks, etc).\nInput: page_name (str), post_id (str)\nOutput: dict with multiple metrics and their values",
    { page_name: z.string(), post_id: z.string() },
    async ({ page_name, post_id }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("GET", `${String(post_id)}/insights`, page.page_access_token, {
          metric: ALL_INSIGHT_METRICS.join(","),
          period: "lifetime",
        }),
      );
    },
  );

  for (const tool of SINGLE_INSIGHT_TOOLS) {
    server.tool(
      tool.name,
      tool.description,
      { page_name: z.string(), post_id: z.string() },
      async ({ page_name, post_id }) => {
        return json(await getInsight(deps, String(page_name), String(post_id), tool.metric));
      },
    );
  }

  server.tool(
    "get_post_top_commenters",
    "Get the top commenters on a post.\nInput: page_name (str), post_id (str)\nOutput: list of user IDs with comment counts",
    { page_name: z.string(), post_id: z.string() },
    async ({ page_name, post_id }) => {
      const page = getPage(deps, String(page_name));
      const url = `${deps.getGraphApiBase()}/${String(post_id)}/comments?fields=id,message,from,created_time&access_token=${encodeURIComponent(page.page_access_token)}`;
      const allComments = await deps.paginateAll<{ from?: { id: string } }>(url);
      const counter: Record<string, number> = {};
      for (const comment of allComments) {
        const userId = comment.from?.id;
        if (userId) counter[userId] = (counter[userId] ?? 0) + 1;
      }
      const sorted = Object.entries(counter)
        .map(([user_id, count]) => ({ user_id, count }))
        .sort((left, right) => right.count - left.count);
      return json(sorted);
    },
  );

  server.tool(
    "get_page_fan_count",
    "Get the Page's total fan/like count.\nInput: page_name (str)\nOutput: integer fan count",
    { page_name: z.string() },
    async ({ page_name }) => {
      const page = getPage(deps, String(page_name));
      const data = await deps.graphApi("GET", page.fb_page_id, page.page_access_token, {
        fields: "fan_count",
      });
      return json({ fan_count: data.fan_count ?? 0 });
    },
  );

  server.tool(
    "get_post_share_count",
    "Get the number of shares for a post.\nInput: page_name (str), post_id (str)\nOutput: integer share count",
    { page_name: z.string(), post_id: z.string() },
    async ({ page_name, post_id }) => {
      const page = getPage(deps, String(page_name));
      const data = await deps.graphApi("GET", String(post_id), page.page_access_token, {
        fields: "shares",
      });
      return json({ shares: data.shares?.count ?? 0 });
    },
  );

  server.tool(
    "get_post_reactions_breakdown",
    "Get counts for all reaction types on a post.\nInput: page_name (str), post_id (str)\nOutput: dict with reaction type counts",
    { page_name: z.string(), post_id: z.string() },
    async ({ page_name, post_id }) => {
      const page = getPage(deps, String(page_name));
      const raw = await deps.graphApi(
        "GET",
        `${String(post_id)}/insights`,
        page.page_access_token,
        {
          metric: REACTION_METRICS.join(","),
          period: "lifetime",
        },
      );
      const results: Record<string, unknown> = {};
      for (const item of raw.data ?? []) {
        results[item.name] = item.values?.[0]?.value;
      }
      return json(results);
    },
  );
}
