/**
 * Facebook MCP Server.
 *
 * This is the agent-facing stdio surface for MCP clients. It is intentionally
 * separate from the Go CLI, which is the human/shell-facing binary.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { debug, graphApi, graphApiBatch, isError, paginateAll, ruploadApi } from "./api.js";
import { getGraphApiBase, loadAssets } from "./config.js";
import { registerAdsTools } from "./tools/ads-tools.js";
import { registerAuthTools } from "./tools/auth-tools.js";
import { registerBusinessTools } from "./tools/business-tools.js";
import { registerCoreTools } from "./tools/core-tools.js";
import { registerInstagramTools } from "./tools/instagram-tools.js";
import { registerPagesPlusTools } from "./tools/pages-plus-tools.js";
import { type ToolServerLike } from "./tools/shared.js";
import { registerWhatsappTools } from "./tools/whatsapp-tools.js";

export function createServer() {
  const assets = loadAssets();
  const server = new McpServer({ name: "FacebookMCP", version: "3.0.0" });
  const toolServer = server as ToolServerLike;

  registerCoreTools(toolServer, {
    assets,
    debug,
    getGraphApiBase,
    graphApi,
    graphApiBatch,
    isError,
    paginateAll,
    ruploadApi,
  });
  registerAdsTools(toolServer, { graphApi });
  registerBusinessTools(toolServer, { graphApi });
  registerInstagramTools(toolServer, { graphApi });
  registerWhatsappTools(toolServer, { graphApi });
  registerPagesPlusTools(toolServer, { graphApi });
  registerAuthTools(toolServer);

  return server;
}

const transport = new StdioServerTransport();
await createServer().connect(transport);
