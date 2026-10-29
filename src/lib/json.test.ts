import { describe, expect, it } from "vitest";
import { parsedJson } from "./json";

describe("parsedJson", () => {
  it("returns the value of valid JSON", () => {
    expect(parsedJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns null for input that is not JSON", () => {
    expect(parsedJson("{nope")).toBeNull();
  });
});
