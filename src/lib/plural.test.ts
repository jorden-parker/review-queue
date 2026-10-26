import { describe, expect, it } from "vitest";
import { plural } from "./plural";

describe("plural", () => {
  it("adds an s for every count except one", () => {
    expect(plural(1, "note")).toBe("1 note");
    expect(plural(0, "note")).toBe("0 notes");
    expect(plural(3, "note")).toBe("3 notes");
  });
});
