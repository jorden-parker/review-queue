import { describe, expect, it } from "vitest";
import { scrollOptionsFor } from "./scroll-motion";

describe("scrollOptionsFor", () => {
  it("lands on a new step instantly instead of sweeping across it", () => {
    expect(scrollOptionsFor("step")).toEqual({ behavior: "instant", block: "start" });
  });

  it("lands on a jumped-to line instantly with context around it", () => {
    expect(scrollOptionsFor("line")).toEqual({ behavior: "instant", block: "center" });
  });

  it("glides between hunks only as far as needed", () => {
    expect(scrollOptionsFor("hunk")).toEqual({ behavior: "smooth", block: "nearest" });
  });
});
