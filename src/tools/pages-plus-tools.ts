import { z } from "zod";
import { createDraftPost, getMe, getPageInsightsMetric, uploadLocalPhoto } from "../domains/pages-plus.js";

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

export interface PagesPlusToolDeps {
  graphApi: GraphFn;
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function parseObject(input?: string): Record<string, string> {
  if (!input) return {};
  const parsed = JSON.parse(input);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, string>;
}

export function registerPagesPlusTools(server: ToolServerLike, deps: PagesPlusToolDeps): void {
  const domainDeps = { graphApi: deps.graphApi };

  server.tool(
    "page_insights_metric",
    "Get a single page insights metric.",
    {
      page_id: z.string(),
      access_token: z.string(),
      metric: z.string(),
      period: z.string().optional(),
    },
    async ({ page_id, access_token, metric, period }) => {
      return json(
        await getPageInsightsMetric(
          domainDeps,
          String(page_id),
          String(access_token),
          String(metric),
          period ? String(period) : "day",
        ),
      );
    },
  );

  server.tool(
    "post_local",
    "Upload a local photo to a page.",
    {
      page_id: z.string(),
      access_token: z.string(),
      file_path: z.string(),
      caption: z.string().optional(),
    },
    async ({ page_id, access_token, file_path, caption }) => {
      return json(
        await uploadLocalPhoto(
          domainDeps,
          String(page_id),
          String(access_token),
          String(file_path),
          caption ? String(caption) : undefined,
        ),
      );
    },
  );

  server.tool(
    "draft",
    "Create a draft post for a page.",
    {
      page_id: z.string(),
      access_token: z.string(),
      message: z.string(),
      params_json: z.string().optional(),
    },
    async ({ page_id, access_token, message, params_json }) => {
      return json(
        await createDraftPost(
          domainDeps,
          String(page_id),
          String(access_token),
          String(message),
          parseObject(params_json ? String(params_json) : undefined),
        ),
      );
    },
  );

  server.tool(
    "me",
    "Get /me profile for the access token.",
    { access_token: z.string(), params_json: z.string().optional() },
    async ({ access_token, params_json }) => {
      return json(
        await getMe(domainDeps, String(access_token), parseObject(params_json ? String(params_json) : undefined)),
      );
    },
  );
}
