import { describe, expect, it } from "vitest";
import type { PreparedFile } from "@/lib/review/prepare";
import { addedHunk, fileDiff, removedHunk } from "@/test/diff-builders";
import { firstNoteLine, hunkElementId, hunkIdsFor } from "./hunk-index";

const FILES: PreparedFile[] = [
  {
    ...fileDiff("a.ts", [addedHunk(["x"], 4), removedHunk(["y"])]),
    highlighted: [],
    navigable: true,
  },
];

describe("hunk index", () => {
  it("lists hunk ids for steps", () => {
    expect(
      hunkIdsFor([
        {
          id: "s",
          title: "",
          role: "core",
          reason: "",
          changedLines: 1,
          files: [{ path: "a.ts", hunkIndexes: [0, 1] }],
        },
      ]),
    ).toEqual(["hunk-a.ts-0", "hunk-a.ts-1"]);
  });

  it("finds the first line you can comment on", () => {
    expect(firstNoteLine(FILES, hunkElementId("a.ts", 0))).toEqual({ path: "a.ts", line: 4 });
    expect(firstNoteLine(FILES, hunkElementId("a.ts", 1))).toBeNull();
    expect(firstNoteLine(FILES, null)).toBeNull();
  });
});
