import { describe, expect, it } from "vitest";
import { addedHunk, fileDiff, removedHunk } from "@/test/diff-builders";
import { RULE_IDS, type SymbolDefinition } from "@/lib/types";
import { checksFor } from "./checks";
import { findHotspots } from "./find-hotspots";

const LOAD_USER: SymbolDefinition = {
  name: "loadUser",
  kind: "function",
  path: "src/thing.ts",
  line: 1,
  endLine: 9,
};

const BUSY_CALLERS = {
  churn: new Map<string, number>(),
  callerCounts: new Map([["loadUser", 5]]),
  touchedDefinitions: new Map([["src/thing.ts", [LOAD_USER]]]),
};

describe("checksFor", () => {
  it("gives every built-in rule something to check", () => {
    const diffs = [
      fileDiff("src/thing.ts", [
        addedHunk(["execSync(cmd)", "console.log(user)", "// TODO: later", "} catch (e) {}"]),
      ]),
      fileDiff("src/old.test.ts", [removedHunk(["it('works', () => {})"])]),
      fileDiff("migrations/001.sql", [addedHunk(["ALTER TABLE users ADD age int;"])]),
    ];
    const rules = findHotspots(diffs, BUSY_CALLERS).map((hotspot) => hotspot.rule);
    expect(rules).toContain("busy-function-change");
    expect(rules.length).toBeGreaterThan(4);
    for (const rule of rules) expect(checksFor(rule), rule).not.toEqual([]);
  });

  it("gives every rule id a checklist, including the model's suggestions", () => {
    for (const rule of RULE_IDS) expect(checksFor(rule), rule).not.toEqual([]);
  });
});
