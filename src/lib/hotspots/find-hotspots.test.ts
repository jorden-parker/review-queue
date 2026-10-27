import { describe, expect, it } from "vitest";
import type { FileDiff, SymbolDefinition } from "@/lib/types";
import { addedHunk, fileDiff, lines, removedHunk } from "@/test/diff-builders";
import { findHotspots } from "./find-hotspots";
import { changedSignatureNames } from "./rules";

const EMPTY = {
  churn: new Map<string, number>(),
  callerCounts: new Map<string, number>(),
  touchedDefinitions: new Map<string, SymbolDefinition[]>(),
};
const SPEC = fileDiff("src/thing.test.ts", [addedHunk(["it('works', () => {})"])]);

function rulesFor(diffs: FileDiff[], context = EMPTY): string[] {
  return findHotspots(diffs, context).map((hotspot) => hotspot.rule);
}

function codeFile(added: string[], file = "src/thing.ts"): FileDiff {
  return fileDiff(file, [addedHunk(added)]);
}

describe("findHotspots", () => {
  it.each([
    ["runs-commands", "execSync(`rm ${dir}`)"],
    ["sql-strings", 'db.query("SELECT * FROM users WHERE id = " + id)'],
    ["hardcoded-secret", 'const apiKey = "sk-live-123456"'],
    ["raw-html", "<div dangerouslySetInnerHTML={{ __html: body }} />"],
    ["auth-crypto", "if (!user.isAdmin) return;"],
    ["concurrency", "await Promise.all(jobs)"],
    ["swallowed-error", "} catch (e) {}"],
    ["swallowed-error", "_ = err"],
    ["magic-value", "const timeout = 30000;"],
    ["todo", "// TODO: handle errors"],
    ["debug-output", "console.log(user)"],
    ["suppression", "// @ts-ignore"],
    ["commented-code", "// doThing(a, b);"],
  ])("flags %s", (rule, text) => {
    expect(rulesFor([codeFile([text]), SPEC])).toContain(rule);
  });

  it("does not flag plain code", () => {
    expect(rulesFor([codeFile(["const total = items.length;"]), SPEC])).toEqual([]);
  });

  it("collapses repeats into one hotspot per rule and file", () => {
    const [hotspot] = findHotspots(
      [codeFile(["console.log(1)", "x()", "console.log(2)"]), SPEC],
      EMPTY,
    );
    expect(hotspot).toMatchObject({
      rule: "debug-output",
      line: 1,
      title: "Debug output left in (2 places)",
    });
  });

  it("stays fast on very long crafted lines", () => {
    const crafted = ["SELECT ".repeat(6000), "type (".repeat(7000)];
    const started = performance.now();
    findHotspots([codeFile(crafted), fileDiff("src/old.ts", [removedHunk(crafted)])], EMPTY);
    expect(performance.now() - started).toBeLessThan(300);
  });

  it("skips security patterns in tests and everything in generated files", () => {
    expect(rulesFor([codeFile(["execSync(cmd)"], "src/a.test.ts")])).toEqual([]);
    expect(rulesFor([codeFile(["console.log(1)"], "dist/app.min.js"), SPEC])).toEqual([]);
  });

  it("flags signature changes with caller counts", () => {
    const diff = fileDiff("src/users.ts", [
      removedHunk(["export function loadUser(id: string) {"]),
      addedHunk(["export function loadUser(id: string, force: boolean) {"]),
    ]);
    expect(changedSignatureNames([diff])).toEqual(["loadUser"]);
    const [hotspot] = findHotspots([diff, SPEC], {
      ...EMPTY,
      callerCounts: new Map([["loadUser", 9]]),
    });
    expect(hotspot).toMatchObject({ rule: "signature-change", severity: "high" });
    expect(hotspot.why).toContain("9 other places");
  });

  it("flags body-only changes to functions with many callers", () => {
    const diff = fileDiff("src/users.ts", [addedHunk(["  return cache.get(id) ?? null;"], 12)]);
    const load = {
      name: "loadUser",
      kind: "function" as const,
      path: "src/users.ts",
      line: 10,
      endLine: 20,
    };
    const hotspots = findHotspots([diff, SPEC], {
      ...EMPTY,
      callerCounts: new Map([["loadUser", 5]]),
      touchedDefinitions: new Map([["src/users.ts", [load]]]),
    });
    expect(hotspots[0]).toMatchObject({
      rule: "busy-function-change",
      severity: "medium",
      line: 10,
    });
    expect(hotspots[0].title).toBe("loadUser is used in 5 other places");
  });

  it("does not double-flag a busy function whose signature also changed", () => {
    const diff = fileDiff("src/users.ts", [
      removedHunk(["export function loadUser(id: string) {"], 10),
      addedHunk(["export function loadUser(id: string, force: boolean) {"], 10),
    ]);
    const load = {
      name: "loadUser",
      kind: "function" as const,
      path: "src/users.ts",
      line: 10,
      endLine: 20,
    };
    const rules = findHotspots([diff, SPEC], {
      ...EMPTY,
      callerCounts: new Map([["loadUser", 5]]),
      touchedDefinitions: new Map([["src/users.ts", [load]]]),
    }).map((hotspot) => hotspot.rule);
    expect(rules).toContain("signature-change");
    expect(rules).not.toContain("busy-function-change");
  });

  it("stays quiet for a busy function with few callers", () => {
    const diff = fileDiff("src/users.ts", [addedHunk(["  return null;"], 12)]);
    const load = {
      name: "loadUser",
      kind: "function" as const,
      path: "src/users.ts",
      line: 10,
      endLine: 20,
    };
    const rules = findHotspots([diff, SPEC], {
      ...EMPTY,
      callerCounts: new Map([["loadUser", 2]]),
      touchedDefinitions: new Map([["src/users.ts", [load]]]),
    }).map((hotspot) => hotspot.rule);
    expect(rules).not.toContain("busy-function-change");
  });

  it("flags big hunks and heavy branching", () => {
    expect(rulesFor([codeFile(lines(90)), SPEC])).toContain("big-hunk");
    expect(rulesFor([codeFile(lines(6, "if (x) y")), SPEC])).toContain("branching");
  });

  it("flags migrations, manifests and lockfile drift", () => {
    expect(rulesFor([codeFile(["ALTER TABLE x"], "db/migrations/001.sql"), SPEC])).toContain(
      "migration",
    );
    expect(rulesFor([codeFile(['"zod": "4"'], "package.json")])).toEqual(["dependencies"]);
    expect(rulesFor([codeFile(["a"], "pnpm-lock.yaml")])).toEqual(["lockfile-drift"]);
    expect(rulesFor([codeFile(["a"], "bun.lock")])).toEqual(["lockfile-drift"]);
    expect(rulesFor([codeFile(["a"], "pnpm-lock.yaml"), codeFile(["b"], "package.json")])).toEqual([
      "dependencies",
    ]);
  });

  it("flags code files that change far more than the rest of the repo", () => {
    const quiet = Array.from({ length: 30 }, (_, index): [string, number] => [
      `src/q${index}.ts`,
      2,
    ]);
    const churn = new Map([...quiet, ["src/thing.ts", 25], ["readme.md", 90]]);
    expect(rulesFor([codeFile(["x"]), SPEC], { ...EMPTY, churn })).toEqual(["churn"]);
    expect(rulesFor([codeFile(["x"], "readme.md")], { ...EMPTY, churn })).toEqual([]);
  });

  it("does not flag churn when the whole repo changes that often", () => {
    const busy = Array.from({ length: 30 }, (_, index): [string, number] => [
      `src/b${index}.ts`,
      40,
    ]);
    const churn = new Map([...busy, ["src/thing.ts", 25]]);
    expect(rulesFor([codeFile(["x"]), SPEC], { ...EMPTY, churn })).toEqual([]);
  });

  it("flags removed tests and missing tests", () => {
    const removed = fileDiff("src/a.test.ts", [removedHunk(["it('works', () => {})"])]);
    expect(rulesFor([removed])).toEqual(["tests-removed"]);
    expect(rulesFor([codeFile(lines(12))])).toEqual(["no-tests"]);
    expect(rulesFor([codeFile(lines(12)), SPEC])).toEqual([]);
  });

  it("sorts by severity", () => {
    const severities = findHotspots(
      [codeFile(["console.log(1)", "execSync(cmd)", "await Promise.all(x)"]), SPEC],
      EMPTY,
    ).map((hotspot) => hotspot.severity);
    expect(severities).toEqual(["high", "medium", "low"]);
  });
});
