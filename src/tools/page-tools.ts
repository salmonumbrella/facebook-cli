import { z } from "zod";
import { listPageSummaries } from "../lib/page-registry.js";
import { getPage, type CoreToolDeps } from "./runtime.js";
import { json, type ToolServerLike } from "./shared.js";

export function registerPageTools(server: ToolServerLike, deps: CoreToolDeps): void {
  server.tool(
    "list_pages",
    "List all available Facebook Pages.\nInput: None\nOutput: list of page objects with page_name, display_name, fb_page_id",
    {},
    async () => {
      return json(listPageSummaries(deps.assets));
    },
  );

  server.tool(
    "post_to_facebook",
    "Create a new Facebook Page post with a text message.\nInput: page_name (str), message (str)\nOutput: dict with post ID and creation status",
    { page_name: z.string(), message: z.string() },
    async ({ page_name, message }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("POST", `${page.fb_page_id}/feed`, page.page_access_token, undefined, {
          message: String(message),
        }),
      );
    },
  );

  server.tool(
    "get_page_posts",
    "Fetch the most recent posts on the Page.\nInput: page_name (str)\nOutput: dict with list of post objects and metadata",
    { page_name: z.string() },
    async ({ page_name }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("GET", `${page.fb_page_id}/posts`, page.page_access_token, {
          fields: "id,message,created_time",
        }),
      );
    },
  );

  server.tool(
    "post_image_to_facebook",
    "Post an image with a caption to the Facebook page.\nInput: page_name (str), image_url (str), caption (str)\nOutput: dict of post result",
    { page_name: z.string(), image_url: z.string(), caption: z.string() },
    async ({ page_name, image_url, caption }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi(
          "POST",
          `${page.fb_page_id}/photos`,
          page.page_access_token,
          undefined,
          {
            url: String(image_url),
            caption: String(caption),
          },
        ),
      );
    },
  );

  server.tool(
    "update_post",
    "Updates an existing post's message.\nInput: page_name (str), post_id (str), new_message (str)\nOutput: dict of update result",
    { page_name: z.string(), post_id: z.string(), new_message: z.string() },
    async ({ page_name, post_id, new_message }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("POST", String(post_id), page.page_access_token, undefined, {
          message: String(new_message),
        }),
      );
    },
  );

  server.tool(
    "delete_post",
    "Delete a specific post from the Facebook Page.\nInput: page_name (str), post_id (str)\nOutput: dict with deletion result",
    { page_name: z.string(), post_id: z.string() },
    async ({ page_name, post_id }) => {
      const page = getPage(deps, String(page_name));
      return json(await deps.graphApi("DELETE", String(post_id), page.page_access_token));
    },
  );

  server.tool(
    "schedule_post",
    "Schedule a new post for future publishing.\nInput: page_name (str), message (str), publish_time (Unix timestamp)\nOutput: dict with scheduled post info",
    { page_name: z.string(), message: z.string(), publish_time: z.number() },
    async ({ page_name, message, publish_time }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("POST", `${page.fb_page_id}/feed`, page.page_access_token, undefined, {
          message: String(message),
          published: "false",
          scheduled_publish_time: String(publish_time),
        }),
      );
    },
  );
}
