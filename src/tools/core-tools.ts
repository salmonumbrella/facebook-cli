import type { ToolServerLike } from "./shared.js";
import { registerAnalyticsTools } from "./analytics-tools.js";
import { registerCommentTools } from "./comment-tools.js";
import type { CoreToolDeps } from "./runtime.js";
import { registerMediaTools } from "./media-tools.js";
import { registerPageTools } from "./page-tools.js";

export function registerCoreTools(server: ToolServerLike, deps: CoreToolDeps): void {
  registerPageTools(server, deps);
  registerCommentTools(server, deps);
  registerAnalyticsTools(server, deps);
  registerMediaTools(server, deps);
}
