import { z } from "zod";
import { listIgAccounts, listIgMedia, publishIgMedia } from "../domains/instagram.js";

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

export interface InstagramToolDeps {
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

function parseMedia(input?: string): {
  image_url?: string;
  video_url?: string;
  caption?: string;
  media_type?: string;
} {
  if (!input) return {};
  const parsed = JSON.parse(input);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as {
    image_url?: string;
    video_url?: string;
    caption?: string;
    media_type?: string;
  };
}

export function registerInstagramTools(server: ToolServerLike, deps: InstagramToolDeps): void {
  const domainDeps = { graphApi: deps.graphApi };

  server.tool(
    "ig_accounts_list",
    "List Instagram business accounts accessible from the token.",
    { access_token: z.string() },
    async ({ access_token }) => {
      return json(await listIgAccounts(domainDeps, String(access_token)));
    },
  );

  server.tool(
    "ig_media_list",
    "List media for an Instagram account.",
    { ig_user_id: z.string(), access_token: z.string(), params_json: z.string().optional() },
    async ({ ig_user_id, access_token, params_json }) => {
      return json(
        await listIgMedia(
          domainDeps,
          String(ig_user_id),
          String(access_token),
          parseObject(params_json ? String(params_json) : undefined),
        ),
      );
    },
  );

  server.tool(
    "ig_publish",
    "Publish media to an Instagram account.",
    { ig_user_id: z.string(), access_token: z.string(), media_json: z.string().optional() },
    async ({ ig_user_id, access_token, media_json }) => {
      return json(
        await publishIgMedia(
          domainDeps,
          String(ig_user_id),
          String(access_token),
          parseMedia(media_json ? String(media_json) : undefined),
        ),
      );
    },
  );
}
