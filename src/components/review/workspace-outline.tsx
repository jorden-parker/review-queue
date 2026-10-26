"use client";

import type { PreparedFile } from "@/lib/review/prepare";
import type { OutlineSymbol, PullRequestRef, Step, SymbolPosition } from "@/lib/types";
import type { LineTarget } from "./locate";
import { OutlineList, type OutlineFile } from "./outline-list";
import { diffLinesOf } from "./outline-rows";
import { useOutlines } from "./use-file-symbols";

type WorkspaceOutlineProps = {
  pullRequest: PullRequestRef;
  headSha: string;
  step: Step | null;
  files: ReadonlyMap<string, PreparedFile>;
  onGoTo: (target: LineTarget) => void;
  onPeek: (position: SymbolPosition) => void;
};

function navigableStepFiles(step: Step | null, files: ReadonlyMap<string, PreparedFile>) {
  return (step?.files ?? []).flatMap((stepFile) => {
    const file = files.get(stepFile.path);
    return file?.navigable ? [{ file, hunkIndexes: stepFile.hunkIndexes }] : [];
  });
}

function indexLookup(symbol: OutlineSymbol): SymbolPosition {
  return { name: symbol.name, path: symbol.path, line: symbol.line, character: 0, side: "old" };
}

export function WorkspaceOutline({
  pullRequest,
  headSha,
  step,
  files,
  onGoTo,
  onPeek,
}: WorkspaceOutlineProps) {
  const stepFiles = navigableStepFiles(step, files);
  const outlines = useOutlines(
    pullRequest,
    headSha,
    stepFiles.map(({ file }) => file.path),
  );
  const outlineFiles: OutlineFile[] = stepFiles.map(({ file, hunkIndexes }) => ({
    path: file.path,
    symbols: outlines.get(file.path),
    diff: diffLinesOf(file, hunkIndexes),
  }));
  return (
    <OutlineList
      files={outlineFiles}
      onOpen={(symbol, shown) =>
        shown
          ? onGoTo({ path: symbol.path, line: symbol.line, name: symbol.name })
          : onPeek(indexLookup(symbol))
      }
    />
  );
}
