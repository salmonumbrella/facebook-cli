import { z } from "zod";
import { getPage, NEGATIVE_KEYWORDS, type CoreToolDeps } from "./runtime.js";
import { asStringArray, json, type ToolServerLike } from "./shared.js";

export function registerCommentTools(server: ToolServerLike, deps: CoreToolDeps): void {
  server.tool(
    "get_post_comments",
    "Retrieve all comments for a given post.\nInput: page_name (str), post_id (str)\nOutput: dict with comment objects",
    { page_name: z.string(), post_id: z.string() },
    async ({ page_name, post_id }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("GET", `${String(post_id)}/comments`, page.page_access_token, {
          fields: "id,message,from,created_time",
        }),
      );
    },
  );

  server.tool(
    "reply_to_comment",
    "Reply to a specific comment on a Facebook post.\nInput: page_name (str), comment_id (str), message (str)\nOutput: dict with reply creation status",
    { page_name: z.string(), comment_id: z.string(), message: z.string() },
    async ({ page_name, comment_id, message }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi(
          "POST",
          `${String(comment_id)}/comments`,
          page.page_access_token,
          undefined,
          {
            message: String(message),
          },
        ),
      );
    },
  );

  server.tool(
    "delete_comment",
    "Delete a specific comment from the Page.\nInput: page_name (str), comment_id (str)\nOutput: dict with deletion result",
    { page_name: z.string(), comment_id: z.string() },
    async ({ page_name, comment_id }) => {
      const page = getPage(deps, String(page_name));
      return json(await deps.graphApi("DELETE", String(comment_id), page.page_access_token));
    },
  );

  server.tool(
    "hide_comment",
    "Hide a comment from public view.\nInput: page_name (str), comment_id (str)\nOutput: dict with hide result",
    { page_name: z.string(), comment_id: z.string() },
    async ({ page_name, comment_id }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("POST", String(comment_id), page.page_access_token, undefined, {
          is_hidden: "true",
        }),
      );
    },
  );

  server.tool(
    "unhide_comment",
    "Unhide a previously hidden comment.\nInput: page_name (str), comment_id (str)\nOutput: dict with unhide result",
    { page_name: z.string(), comment_id: z.string() },
    async ({ page_name, comment_id }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("POST", String(comment_id), page.page_access_token, undefined, {
          is_hidden: "false",
        }),
      );
    },
  );

  server.tool(
    "delete_comment_from_post",
    "Alias to delete a comment on a post.\nInput: page_name (str), comment_id (str)\nOutput: dict with deletion result",
    { page_name: z.string(), comment_id: z.string() },
    async ({ page_name, comment_id }) => {
      const page = getPage(deps, String(page_name));
      return json(await deps.graphApi("DELETE", String(comment_id), page.page_access_token));
    },
  );

  server.tool(
    "filter_negative_comments",
    "Filter comments for basic negative sentiment.\nInput: page_name (str), comments (JSON string of comments response)\nOutput: list of flagged negative comments",
    {
      page_name: z.string(),
      comments: z.string().describe("JSON string of the comments API response"),
    },
    async ({ comments }) => {
      const parsed = JSON.parse(String(comments)) as { data?: Array<{ message?: string }> };
      const data = parsed.data ?? [];
      const flagged = data.filter((comment) =>
        NEGATIVE_KEYWORDS.some((keyword) =>
          (comment.message ?? "").toLowerCase().includes(keyword),
        ),
      );
      return json(flagged);
    },
  );

  server.tool(
    "bulk_delete_comments",
    "Delete multiple comments by ID using batch API.\nInput: page_name (str), comment_ids (list[str])\nOutput: list of deletion results",
    { page_name: z.string(), comment_ids: z.array(z.string()) },
    async ({ page_name, comment_ids }) => {
      const page = getPage(deps, String(page_name));
      const commentIDs = asStringArray(comment_ids);
      const requests = commentIDs.map((commentId) => ({
        method: "DELETE",
        relative_url: commentId,
      }));
      const responses = await deps.graphApiBatch(page.page_access_token, requests);
      return json(
        commentIDs.map((commentId, index) => ({
          comment_id: commentId,
          result: responses[index].body,
          success: responses[index].code === 200,
        })),
      );
    },
  );

  server.tool(
    "bulk_hide_comments",
    "Hide multiple comments by ID using batch API.\nInput: page_name (str), comment_ids (list[str])\nOutput: list of hide results",
    { page_name: z.string(), comment_ids: z.array(z.string()) },
    async ({ page_name, comment_ids }) => {
      const page = getPage(deps, String(page_name));
      const commentIDs = asStringArray(comment_ids);
      const requests = commentIDs.map((commentId) => ({
        method: "POST",
        relative_url: commentId,
        body: { is_hidden: "true" },
      }));
      const responses = await deps.graphApiBatch(page.page_access_token, requests);
      return json(
        commentIDs.map((commentId, index) => ({
          comment_id: commentId,
          result: responses[index].body,
          success: responses[index].code === 200,
        })),
      );
    },
  );
}
