import { describe, expect, it } from "vitest";
import type { DiffLine, DiffLineKind, Hunk } from "@/lib/types";
import { fileLayout, gapContaining } from "./context-gaps";

const KINDS: Record<string, DiffLineKind> = { " ": "context", "+": "add", "-": "del" };

function hunk(oldStart: number, newStart: number, markers: string): Hunk {
  let oldLine = oldStart;
  let newLine = newStart;
  const lines: DiffLine[] = [...markers].map((marker) => {
    const kind = KINDS[marker];
    return {
      kind,
      text: marker,
      oldLine: kind === "add" ? null : oldLine++,
      newLine: kind === "del" ? null : newLine++,
    };
  });
  return { header: "", oldStart, newStart, lines };
}

describe("fileLayout", () => {
  const hunks = [hunk(10, 10, " + "), hunk(30, 31, " - ")];

  it("puts gaps before, between and after the shown hunks", () => {
    expect(fileLayout(hunks, [0, 1], 50)).toEqual([
      { kind: "gap", gap: { from: 1, to: 9, oldOffset: 0 } },
      { kind: "hunk", index: 0 },
      { kind: "gap", gap: { from: 13, to: 30, oldOffset: -1 } },
      { kind: "hunk", index: 1 },
      { kind: "gap", gap: { from: 33, to: 50, oldOffset: 0 } },
    ]);
  });

  it("leaves the trailing gap open-ended until the line count is known", () => {
    expect(fileLayout(hunks, [1], null).at(-1)).toEqual({
      kind: "gap",
      gap: { from: 33, to: null, oldOffset: 0 },
    });
  });

  it("stops gaps at hunks that belong to another step", () => {
    expect(fileLayout(hunks, [0], 50)).toEqual([
      { kind: "gap", gap: { from: 1, to: 9, oldOffset: 0 } },
      { kind: "hunk", index: 0 },
      { kind: "gap", gap: { from: 13, to: 30, oldOffset: -1 } },
    ]);
    expect(fileLayout(hunks, [1], 50)[0]).toEqual({
      kind: "gap",
      gap: { from: 13, to: 30, oldOffset: -1 },
    });
  });

  it("drops empty gaps where hunks touch the file edges", () => {
    const whole = [hunk(1, 1, " + ")];
    expect(fileLayout(whole, [0], 3)).toEqual([{ kind: "hunk", index: 0 }]);
  });

  it("places a pure deletion after the line it follows", () => {
    expect(fileLayout([hunk(5, 4, "--")], [0], 8)).toEqual([
      { kind: "gap", gap: { from: 1, to: 4, oldOffset: 0 } },
      { kind: "hunk", index: 0 },
      { kind: "gap", gap: { from: 5, to: 8, oldOffset: 2 } },
    ]);
  });
});

describe("gapContaining", () => {
  const hunks = [hunk(10, 10, " + "), hunk(30, 31, " - ")];

  it("names the gap a line falls in by its first line", () => {
    expect(gapContaining(fileLayout(hunks, [0], 50), 20)).toBe(13);
  });

  it("finds a line in the open-ended gap at the end of the file", () => {
    expect(gapContaining(fileLayout(hunks, [1], null), 40)).toBe(33);
  });

  it("finds nothing for a line inside a shown hunk", () => {
    expect(gapContaining(fileLayout(hunks, [0], 50), 11)).toBeNull();
  });
});
