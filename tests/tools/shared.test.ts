import { describe, expect, it } from "bun:test";
import { json, parseObject, parsePayload } from "../../src/tools/shared.js";

describe("json", () => {
  it("wraps data in MCP text content envelope", () => {
    const result = json({ foo: 1 });
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ foo: 1 }, null, 2) }],
    });
  });

  it("handles primitive values", () => {
    const result = json("hello");
    expect(result.content[0].text).toBe('"hello"');
  });

  it("handles null", () => {
    const result = json(null);
    expect(result.content[0].text).toBe("null");
  });

  it("handles arrays", () => {
    const result = json([1, 2, 3]);
    expect(result.content[0].text).toBe(JSON.stringify([1, 2, 3], null, 2));
  });
});

describe("parseObject", () => {
  it("returns empty object for undefined input", () => {
    expect(parseObject(undefined)).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(parseObject("")).toEqual({});
  });

  it("parses valid JSON object", () => {
    expect(parseObject('{"key":"value"}')).toEqual({ key: "value" });
  });

  it("returns empty object for JSON array", () => {
    expect(parseObject("[1,2,3]")).toEqual({});
  });

  it("returns empty object for null JSON", () => {
    expect(parseObject("null")).toEqual({});
  });

  it("throws on invalid JSON", () => {
    expect(() => parseObject("not json")).toThrow();
  });
});

describe("parsePayload", () => {
  it("returns empty object for undefined input", () => {
    expect(parsePayload(undefined)).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(parsePayload()).toEqual({});
  });

  it("parses valid JSON object", () => {
    expect(parsePayload('{"name":"test","status":"ACTIVE"}')).toEqual({
      name: "test",
      status: "ACTIVE",
    });
  });

  it("throws on JSON array", () => {
    expect(() => parsePayload("[1,2,3]")).toThrow("payload_json must be a JSON object");
  });

  it("throws on null JSON", () => {
    expect(() => parsePayload("null")).toThrow("payload_json must be a JSON object");
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePayload("not json")).toThrow();
  });
});
