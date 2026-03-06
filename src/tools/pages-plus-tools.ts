import { z } from "zod";
import {
  createDraftPost,
  getMe,
  getPageInsightsMetric,
  uploadLocalPhoto,
} from "../domains/pages-plus.js";
import { json, parseObject, type GraphFn, type ToolServerLike } from "./shared.js";

export interface PagesPlusToolDeps {
  graphApi: GraphFn;
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
        await getMe(
          domainDeps,
          String(access_token),
          parseObject(params_json ? String(params_json) : undefined),
        ),
      );
    },
  );
}
