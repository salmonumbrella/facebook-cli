import type { z } from "zod";

/** Signature of the graphApi() function passed to tool registrars. */
export type GraphFn = (
  method: string,
  endpoint: string,
  token: string,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
) => Promise<any>;

/** Minimal interface that McpServer satisfies for tool registration. */
export interface ToolServerLike {
  tool: (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: Record<string, unknown>) => Promise<any>,
  ) => void;
}

/** Wrap data in the MCP text-content envelope. */
export function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function asOptionalString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

export function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/** Parse optional JSON string into a record, returning {} on falsy/non-object input. */
export function parseObject(input?: string): Record<string, string> {
  if (!input) return {};
  const parsed = JSON.parse(input);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, string>;
}

/** Parse optional JSON payload string, throwing on non-object input. */
export function parsePayload(payloadJson?: string): Record<string, unknown> {
  if (!payloadJson) return {};
  const parsed = JSON.parse(payloadJson);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("payload_json must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}
