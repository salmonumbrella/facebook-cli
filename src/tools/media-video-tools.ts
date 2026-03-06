import { z } from "zod";
import { getDefaultPageAsset } from "../lib/page-registry.js";
import { getPage, type CoreToolDeps } from "./runtime.js";
import {
  asOptionalNumber,
  asOptionalString,
  asStringArray,
  json,
  type ToolServerLike,
} from "./shared.js";

export function registerMediaVideoTools(server: ToolServerLike, deps: CoreToolDeps): void {
  server.tool(
    "publish_reel",
    "Publish a video reel to a Facebook Page.\nInput: page_name (str), video_url (str), description (str, optional), title (str, optional)\nOutput: dict with reel publish result",
    {
      page_name: z.string(),
      video_url: z.string(),
      description: z.string().optional(),
      title: z.string().optional(),
    },
    async ({ page_name, video_url, description, title }) => {
      const page = getPage(deps, String(page_name));
      const videoURL = String(video_url);
      const descriptionText = asOptionalString(description);
      const titleText = asOptionalString(title);
      deps.debug("reel", "init", page.fb_page_id);
      const start = await deps.graphApi(
        "POST",
        `${page.fb_page_id}/video_reels`,
        page.page_access_token,
        undefined,
        { upload_phase: "start" },
      );
      if (deps.isError(start)) return json({ step: "init", ...start });

      const videoId = start.video_id;
      deps.debug("reel", "upload", videoId);
      const upload = await deps.ruploadApi(videoId, page.page_access_token, { file_url: videoURL });
      if (deps.isError(upload)) return json({ step: "upload", video_id: videoId, ...upload });

      deps.debug("reel", "publish", videoId);
      const finishParams: Record<string, string> = {
        upload_phase: "finish",
        video_id: videoId,
        video_state: "PUBLISHED",
      };
      if (descriptionText) finishParams.description = descriptionText;
      if (titleText) finishParams.title = titleText;

      const result = await deps.graphApi(
        "POST",
        `${page.fb_page_id}/video_reels`,
        page.page_access_token,
        undefined,
        finishParams,
      );
      if (deps.isError(result)) return json({ step: "publish", video_id: videoId, ...result });
      return json(result);
    },
  );

  server.tool(
    "list_reels",
    "List reels published on a Facebook Page.\nInput: page_name (str)\nOutput: dict with list of reel objects",
    { page_name: z.string() },
    async ({ page_name }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("GET", `${page.fb_page_id}/video_reels`, page.page_access_token),
      );
    },
  );

  server.tool(
    "get_video_status",
    "Get the processing status of a video.\nInput: page_name (str), video_id (str)\nOutput: dict with video status info",
    { page_name: z.string(), video_id: z.string() },
    async ({ page_name, video_id }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("GET", String(video_id), page.page_access_token, {
          fields: "status",
        }),
      );
    },
  );

  server.tool(
    "create_slideshow",
    "Create a slideshow video from images.\nInput: page_name (str), image_urls (list[str], 3-7), duration_ms (number, optional), transition_ms (number, optional)\nOutput: dict with slideshow creation result",
    {
      page_name: z.string(),
      image_urls: z.array(z.string()).min(3).max(7),
      duration_ms: z.number().optional(),
      transition_ms: z.number().optional(),
    },
    async ({ page_name, image_urls, duration_ms, transition_ms }) => {
      const page = getPage(deps, String(page_name));
      const imageURLs = asStringArray(image_urls);
      return json(
        await deps.graphApi(
          "POST",
          `${page.fb_page_id}/videos`,
          page.page_access_token,
          undefined,
          {
            slideshow_spec: JSON.stringify({
              images_urls: imageURLs,
              duration_ms: asOptionalNumber(duration_ms) ?? 1750,
              transition_ms: asOptionalNumber(transition_ms) ?? 250,
            }),
          },
        ),
      );
    },
  );

  server.tool(
    "publish_video",
    "Publish a video to a Facebook Page from a URL.\nInput: page_name (str), video_url (str), title (str, optional), description (str, optional)\nOutput: dict with video publish result",
    {
      page_name: z.string(),
      video_url: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
    },
    async ({ page_name, video_url, title, description }) => {
      const page = getPage(deps, String(page_name));
      const params: Record<string, string> = { file_url: String(video_url) };
      const titleText = asOptionalString(title);
      const descriptionText = asOptionalString(description);
      if (titleText) params.title = titleText;
      if (descriptionText) params.description = descriptionText;
      return json(
        await deps.graphApi(
          "POST",
          `${page.fb_page_id}/videos`,
          page.page_access_token,
          undefined,
          params,
        ),
      );
    },
  );

  server.tool(
    "get_music_recommendations",
    "Get music recommendations from Facebook.\nInput: type (enum), countries (str, optional)\nOutput: dict with music recommendation results",
    {
      type: z.enum(["FACEBOOK_POPULAR_MUSIC", "FACEBOOK_NEW_MUSIC", "FACEBOOK_FOR_YOU"]),
      countries: z.string().optional(),
    },
    async ({ type, countries }) => {
      const defaultAsset = getDefaultPageAsset(deps.assets);
      if (!defaultAsset) {
        throw new Error("No pages configured. Set FACEBOOK_ASSETS with at least one page token.");
      }

      const params: Record<string, string> = { type: String(type) };
      const countryList = asOptionalString(countries);
      if (countryList) params.countries = countryList;
      return json(
        await deps.graphApi("GET", "audio/recommendations", defaultAsset.page_access_token, params),
      );
    },
  );

  server.tool(
    "crosspost_video",
    "Crosspost an existing video to a Facebook Page.\nInput: page_name (str), video_id (str)\nOutput: dict with crosspost result",
    { page_name: z.string(), video_id: z.string() },
    async ({ page_name, video_id }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi(
          "POST",
          `${page.fb_page_id}/videos`,
          page.page_access_token,
          undefined,
          {
            crossposted_video_id: String(video_id),
          },
        ),
      );
    },
  );

  server.tool(
    "enable_crossposting",
    "Enable crossposting for a video to specified target pages.\nInput: page_name (str), video_id (str), target_page_ids (list[str])\nOutput: dict with crossposting enablement result",
    { page_name: z.string(), video_id: z.string(), target_page_ids: z.array(z.string()) },
    async ({ page_name, video_id, target_page_ids }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("POST", String(video_id), page.page_access_token, undefined, {
          allow_crossposting_for_pages: asStringArray(target_page_ids),
        }),
      );
    },
  );

  server.tool(
    "crosspost_eligible_pages",
    "List pages eligible for crossposting.\nInput: page_name (str)\nOutput: dict with list of eligible page objects",
    { page_name: z.string() },
    async ({ page_name }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi(
          "GET",
          `${page.fb_page_id}/crosspost_whitelisted_pages`,
          page.page_access_token,
        ),
      );
    },
  );

  server.tool(
    "check_crosspost_eligibility",
    "Check if a video is eligible for crossposting.\nInput: page_name (str), video_id (str)\nOutput: dict with crossposting eligibility status",
    { page_name: z.string(), video_id: z.string() },
    async ({ page_name, video_id }) => {
      const page = getPage(deps, String(page_name));
      return json(
        await deps.graphApi("GET", String(video_id), page.page_access_token, {
          fields: "is_crossposting_eligible",
        }),
      );
    },
  );
}
