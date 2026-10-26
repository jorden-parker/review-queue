import { describe, expect, it } from "vitest";
import { addedHunk, fileDiff, removedHunk } from "@/test/diff-builders";
import { checksFor } from "./checks";
import { findHotspots } from "./find-hotspots";

const EMPTY = { churn: new Map<string, number>(), callerCounts: new Map<string, number>() };

describe("checksFor", () => {
  it("gives every built-in rule something to check", () => {
    const diffs = [
      fileDiff("src/thing.ts", [
        addedHunk(["execSync(cmd)", "console.log(user)", "// TODO: later", "} catch (e) {}"]),
      ]),
      fileDiff("src/old.test.ts", [removedHunk(["it('works', () => {})"])]),
      fileDiff("migrations/001.sql", [addedHunk(["ALTER TABLE users ADD age int;"])]),
    ];
    const rules = findHotspots(diffs, EMPTY).map((hotspot) => hotspot.rule);
    expect(rules.length).toBeGreaterThan(4);
    for (const rule of rules) expect(checksFor(rule), rule).not.toEqual([]);
  });

  it("has nothing for rules it does not know", () => {
    expect(checksFor("ai")).toEqual([]);
  });
});
