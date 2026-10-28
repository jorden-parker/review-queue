import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError } from "./log";

describe("logServerError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs the scope and the error once", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("gh: 422");
    logServerError("submit review", error);
    expect(logged).toHaveBeenCalledOnce();
    expect(logged).toHaveBeenCalledWith("review-queue: submit review failed", error);
  });
});
