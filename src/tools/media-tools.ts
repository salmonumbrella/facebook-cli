import type { CoreToolDeps } from "./runtime.js";
import type { ToolServerLike } from "./shared.js";
import { registerMediaExperimentTools } from "./media-experiment-tools.js";
import { registerMediaMessagingTools } from "./media-messaging-tools.js";
import { registerMediaStoryTools } from "./media-story-tools.js";
import { registerMediaVideoTools } from "./media-video-tools.js";

export function registerMediaTools(server: ToolServerLike, deps: CoreToolDeps): void {
  registerMediaMessagingTools(server, deps);
  registerMediaStoryTools(server, deps);
  registerMediaVideoTools(server, deps);
  registerMediaExperimentTools(server, deps);
}
