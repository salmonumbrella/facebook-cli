import { z } from "zod";
import { createCampaign, listAdAccounts, uploadImage } from "../domains/ads.js";
import { readDeployConfig, validateDeployConfig } from "../domains/ads-deploy.js";

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

export interface AdsToolDeps {
  graphApi: GraphFn;
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function parsePayload(payloadJson?: string): Record<string, unknown> {
  if (!payloadJson) return {};
  const parsed = JSON.parse(payloadJson);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("payload_json must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function registerAdsTools(server: ToolServerLike, deps: AdsToolDeps): void {
  const adsDeps = { graphApi: deps.graphApi };

  server.tool(
    "ads_accounts_list",
    "List ad accounts for the current token owner.",
    { access_token: z.string() },
    async ({ access_token }) => {
      return json(await listAdAccounts(adsDeps, String(access_token)));
    },
  );

  server.tool(
    "ads_campaigns_create",
    "Create a campaign in an ad account.",
    {
      account_id: z.string(),
      access_token: z.string(),
      payload_json: z.string().optional(),
    },
    async ({ account_id, access_token, payload_json }) => {
      const payload = parsePayload(payload_json ? String(payload_json) : undefined);
      return json(await createCampaign(adsDeps, String(account_id), String(access_token), payload));
    },
  );

  server.tool(
    "ads_images_upload",
    "Upload image metadata to an ad account.",
    {
      account_id: z.string(),
      access_token: z.string(),
      payload_json: z.string().optional(),
    },
    async ({ account_id, access_token, payload_json }) => {
      const payload = parsePayload(payload_json ? String(payload_json) : undefined);
      return json(await uploadImage(adsDeps, String(account_id), String(access_token), payload));
    },
  );

  server.tool(
    "ads_validate",
    "Validate ads deploy configuration from JSON or file path.",
    {
      config_json: z.string().optional(),
      config_path: z.string().optional(),
    },
    async ({ config_json, config_path }) => {
      const config = config_json
        ? JSON.parse(String(config_json))
        : config_path
          ? readDeployConfig(String(config_path))
          : null;

      if (!config) {
        throw new Error("Provide either config_json or config_path");
      }

      return json(validateDeployConfig(config));
    },
  );
}
