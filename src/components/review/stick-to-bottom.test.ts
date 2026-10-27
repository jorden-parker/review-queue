import { describe, expect, it } from "vitest";
import { isNearBottom } from "./stick-to-bottom";

describe("isNearBottom", () => {
  it("is true when scrolled exactly to the end", () => {
    expect(isNearBottom({ scrollTop: 800, scrollHeight: 1000, clientHeight: 200 })).toBe(true);
  });

  it("is true within the threshold", () => {
    expect(isNearBottom({ scrollTop: 770, scrollHeight: 1000, clientHeight: 200 })).toBe(true);
  });

  it("is false beyond the threshold", () => {
    expect(isNearBottom({ scrollTop: 700, scrollHeight: 1000, clientHeight: 200 })).toBe(false);
  });

  it("is true when the content is shorter than the pane", () => {
    expect(isNearBottom({ scrollTop: 0, scrollHeight: 100, clientHeight: 200 })).toBe(true);
  });
});
