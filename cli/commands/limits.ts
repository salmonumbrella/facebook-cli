import type { RuntimeContext } from "../lib/context.js";

export async function handleLimitsCommand(
  args: string[],
  _runtime: RuntimeContext,
): Promise<unknown> {
  const sub = args[0];
  if (sub !== "check") {
    throw new Error("Usage: fbcli limits check");
  }

  const parseHeader = (name: string) => {
    const value = process.env[name];
    if (!value) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  return {
    ok: true,
    appUsage: parseHeader("FB_X_APP_USAGE"),
    businessUsage: parseHeader("FB_X_BUSINESS_USE_CASE_USAGE"),
  };
}
