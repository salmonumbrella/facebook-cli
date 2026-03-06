import { z } from "zod";
import { getPage, type CoreToolDeps } from "./runtime.js";
import {
  asOptionalNumber,
  asOptionalString,
  asStringArray,
  json,
  type ToolServerLike,
} from "./shared.js";

export function registerMediaExperimentTools(server: ToolServerLike, deps: CoreToolDeps): void {
  server.tool(
    "create_ab_test",
    "Create an A/B test for video content.\nInput: page_name (str), name (str), description (str), experiment_video_ids (list[str], 2-4), control_video_id (str), optimization_goal (enum), duration_seconds (number, optional), scheduled_timestamp (number, optional)\nOutput: dict with A/B test creation result",
    {
      page_name: z.string(),
      name: z.string(),
      description: z.string(),
      experiment_video_ids: z.array(z.string()).min(2).max(4),
      control_video_id: z.string(),
      optimization_goal: z.enum([
        "AVG_TIME_WATCHED",
        "COMMENTS",
        "IMPRESSIONS",
        "IMPRESSIONS_UNIQUE",
        "LINK_CLICKS",
        "REACTIONS",
        "REELS_PLAYS",
        "SHARES",
        "VIDEO_VIEWS_60S",
      ]),
      duration_seconds: z.number().optional(),
      scheduled_timestamp: z.number().optional(),
    },
    async ({
      page_name,
      name,
      description,
      experiment_video_ids,
      control_video_id,
      optimization_goal,
      duration_seconds,
      scheduled_timestamp,
    }) => {
      const page = getPage(deps, String(page_name));
      const body: Record<string, unknown> = {
        name: String(name),
        description: String(description),
        experiment_video_ids: asStringArray(experiment_video_ids),
        control_video_id: String(control_video_id),
        optimization_goal: String(optimization_goal),
      };
      const durationSeconds = asOptionalNumber(duration_seconds);
      const scheduledTimestamp = asOptionalNumber(scheduled_timestamp);
      if (durationSeconds !== undefined) body.duration_seconds = durationSeconds;
      if (scheduledTimestamp !== undefined) {
        body.scheduled_experiment_timestamp = scheduledTimestamp;
      }
      return json(
        await deps.graphApi(
          "POST",
          `${page.fb_page_id}/ab_tests`,
          page.page_access_token,
          undefined,
          body,
        ),
      );
    },
  );

  server.tool(
    "get_ab_test",
    "Get details of an A/B test.\nInput: page_name (str), test_id (str)\nOutput: dict with A/B test details",
    { page_name: z.string(), test_id: z.string() },
    async ({ page_name, test_id }) => {
      const page = getPage(deps, String(page_name));
      return json(await deps.graphApi("GET", String(test_id), page.page_access_token));
    },
  );

  server.tool(
    "list_ab_tests",
    "List A/B tests for a Facebook Page.\nInput: page_name (str), since (str, optional), until (str, optional)\nOutput: dict with list of A/B test objects",
    {
      page_name: z.string(),
      since: z.string().optional(),
      until: z.string().optional(),
    },
    async ({ page_name, since, until }) => {
      const page = getPage(deps, String(page_name));
      const params: Record<string, string> = {};
      const sinceValue = asOptionalString(since);
      const untilValue = asOptionalString(until);
      if (sinceValue) params.since = sinceValue;
      if (untilValue) params.until = untilValue;
      return json(
        await deps.graphApi("GET", `${page.fb_page_id}/ab_tests`, page.page_access_token, params),
      );
    },
  );

  server.tool(
    "delete_ab_test",
    "Delete an A/B test.\nInput: page_name (str), test_id (str)\nOutput: dict with deletion result",
    { page_name: z.string(), test_id: z.string() },
    async ({ page_name, test_id }) => {
      const page = getPage(deps, String(page_name));
      return json(await deps.graphApi("DELETE", String(test_id), page.page_access_token));
    },
  );
}
