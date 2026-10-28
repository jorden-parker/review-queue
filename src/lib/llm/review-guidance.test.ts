import { describe, expect, it } from "vitest";
import { reviewGuidance } from "./review-guidance";

const GENERAL_HEADING = "Review the design as a senior engineer";
const TYPESCRIPT_HEADING = "TypeScript and JavaScript:";
const REACT_HEADING = "React:";

describe("reviewGuidance", () => {
  it("always asks for SOLID, KISS and YAGNI, and for real problems over nitpicks", () => {
    const guidance = reviewGuidance(["main.go"]);
    expect(guidance).toContain(GENERAL_HEADING);
    expect(guidance).toContain("SOLID");
    expect(guidance).toContain("KISS");
    expect(guidance).toContain("YAGNI");
    expect(guidance).toContain("nitpicks");
  });

  it("asks for logic that repeats an existing helper and for unused code", () => {
    const guidance = reviewGuidance(["main.go"]);
    expect(guidance).toContain("repeats an existing helper elsewhere in the repo");
    expect(guidance).toContain("dead or unused code");
  });

  it("leaves out the TypeScript and React rules when no such file changes", () => {
    const guidance = reviewGuidance(["main.go", "README.md"]);
    expect(guidance).not.toContain(TYPESCRIPT_HEADING);
    expect(guidance).not.toContain(REACT_HEADING);
  });

  it("adds the TypeScript rules for TypeScript and JavaScript files", () => {
    for (const path of ["src/a.ts", "lib/b.mjs", "c.cts", "d.js"]) {
      expect(reviewGuidance([path])).toContain(TYPESCRIPT_HEADING);
      expect(reviewGuidance([path])).not.toContain(REACT_HEADING);
    }
  });

  it("adds the React rules as well for component files", () => {
    for (const path of ["src/view.tsx", "src/old.jsx"]) {
      const guidance = reviewGuidance([path]);
      expect(guidance).toContain(TYPESCRIPT_HEADING);
      expect(guidance).toContain(REACT_HEADING);
    }
  });

  it("matches extensions without regard to case", () => {
    expect(reviewGuidance(["src/View.TSX"])).toContain(REACT_HEADING);
  });

  it("stays short enough for a small local model", () => {
    expect(reviewGuidance(["src/view.tsx"]).length).toBeLessThan(2_400);
  });
});
