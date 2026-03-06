import { z } from "zod";
import { getPage, type CoreToolDeps } from "./runtime.js";
import { json, type ToolServerLike } from "./shared.js";

export function registerMediaStoryTools(server: ToolServerLike, deps: CoreToolDeps): void {
  server.tool(
    "publish_video_story",
    "Publish a video story to a Facebook Page.\nInput: page_name (str), video_url (str)\nOutput: dict with story publish result",
    { page_name: z.string(), video_url: z.string() },
    async ({ page_name, video_url }) => {
      const page = getPage(deps, String(page_name));
      const videoURL = String(video_url);
      deps.debug("video-story", "init", page.fb_page_id);
      const start = await deps.graphApi(
        "POST",
        `${page.fb_page_id}/video_stories`,
        page.page_access_token,
        undefined,
        { upload_phase: "start" },
      );
      if (deps.isError(start)) return json({ step: "init", ...start });

      const videoId = start.video_id;
      deps.debug("video-story", "upload", videoId);
      const upload = await deps.ruploadApi(videoId, page.page_access_token, { file_url: videoURL });
      if (deps.isError(upload)) return json({ step: "upload", video_id: videoId, ...upload });

      deps.debug("video-story", "publish", videoId);
      const result = await deps.graphApi(
        "POST",
        `${page.fb_page_id}/video_stories`,
        page.page_access_token,
        undefined,
        { upload_phase: "finish", video_id: videoId },
      );
      if (deps.isError(result)) return json({ step: "publish", video_id: videoId, ...result });
      return json(result);
    },
  );

  server.tool(
    "publish_photo_story",
    "Publish a photo story to a Facebook Page.\nInput: page_name (str), photo_url (str)\nOutput: dict with story publish result",
    { page_name: z.string(), photo_url: z.string() },
    async ({ page_name, photo_url }) => {
      const page = getPage(deps, String(page_name));
      deps.debug("photo-story", "upload", page.fb_page_id);
      const uploaded = await deps.graphApi(
        "POST",
        `${page.fb_page_id}/photos`,
        page.page_access_token,
        undefined,
        { url: String(photo_url), published: "false" },
      );
      if (deps.isError(uploaded)) return json({ step: "upload", ...uploaded });

      const photoId = String(uploaded.id);
      deps.debug("photo-story", "publish", photoId);
      const result = await deps.graphApi(
        "POST",
        `${page.fb_page_id}/photo_stories`,
        page.page_access_token,
        undefined,
        { photo_id: photoId },
      );
      if (deps.isError(result)) return json({ step: "publish", photo_id: photoId, ...result });
      return json(result);
    },
  );

  server.tool(
    "list_stories",
    "List stories on a Facebook Page.\nInput: page_name (str)\nOutput: dict with list of story objects",
    { page_name: z.string() },
    async ({ page_name }) => {
      const page = getPage(deps, String(page_name));
      return json(await deps.graphApi("GET", `${page.fb_page_id}/stories`, page.page_access_token));
    },
  );
}
