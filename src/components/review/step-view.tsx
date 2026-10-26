"use client";

import { useState } from "react";
import type { PreparedFile } from "@/lib/review/prepare";
import type { Hotspot, Note, NoteKind, Step, StepFile } from "@/lib/types";
import { CodeLine, type LineHandlers } from "./code-line";
import { hunkElementId } from "./hunk-index";
import { lineElementId, type LineTarget } from "./locate";
import { NoteComposer } from "./note-composer";

const NO_LINKS = new Set<string>();

export type StepViewContext = {
  files: Map<string, PreparedFile>;
  linkable: Set<string>;
  hotspots: Hotspot[];
  notes: Note[];
  composer: LineTarget | null;
  activeHunkId: string | null;
  handlers: LineHandlers & {
    onSaveNote: (target: LineTarget, kind: NoteKind, body: string) => void;
    onCancelNote: () => void;
  };
};

function FileHeader({ file }: { file: PreparedFile }) {
  const renamed = file.status === "renamed" ? `${file.oldPath} → ` : "";
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-panel px-4 py-2 font-sans text-sm">
      <span className="font-mono font-bold">
        {renamed}
        {file.path}
      </span>
      <span className="shrink-0 text-muted">
        <span className="text-add-ink">+{file.additions}</span>{" "}
        <span className="text-del-ink">−{file.deletions}</span> · {file.status}
      </span>
    </div>
  );
}

function HunkBlock({
  file,
  hunkIndex,
  context,
}: {
  file: PreparedFile;
  hunkIndex: number;
  context: StepViewContext;
}) {
  const hunk = file.hunks[hunkIndex];
  const highlighted = file.highlighted[hunkIndex] ?? [];
  const id = hunkElementId(file.path, hunkIndex);
  const active = context.activeHunkId === id;
  return (
    <div
      id={id}
      className={`scroll-mt-24 border-l-4 ${active ? "border-focus" : "border-transparent"}`}
    >
      <div className="bg-sunken px-4 py-1 text-muted">
        @@ {hunk.oldStart} → {hunk.newStart} {hunk.header}
      </div>
      {hunk.lines.map((line, lineIndex) => {
        const lineNumber = line.newLine;
        const target = lineNumber !== null ? { path: file.path, line: lineNumber } : null;
        const composing =
          target && context.composer?.path === target.path && context.composer.line === target.line;
        return (
          <div key={lineIndex}>
            <CodeLine
              path={file.path}
              line={line}
              tokens={highlighted[lineIndex] ?? [{ text: line.text }]}
              linkable={file.navigable ? context.linkable : NO_LINKS}
              hotspots={context.hotspots.filter(
                (hotspot) =>
                  hotspot.path === file.path && lineNumber !== null && hotspot.line === lineNumber,
              )}
              notes={context.notes.filter(
                (note) =>
                  note.path === file.path && note.line === lineNumber && lineNumber !== null,
              )}
              elementId={target ? lineElementId(target) : undefined}
              handlers={context.handlers}
            />
            {composing && target && (
              <NoteComposer
                onSave={(kind, body) => context.handlers.onSaveNote(target, kind, body)}
                onCancel={context.handlers.onCancelNote}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileBlock({
  stepFile,
  context,
  collapsed,
}: {
  stepFile: StepFile;
  context: StepViewContext;
  collapsed: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsed);
  const file = context.files.get(stepFile.path);
  if (!file) return null;
  const empty = file.binary || stepFile.hunkIndexes.length === 0;
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <FileHeader file={file} />
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-4 py-3 text-left font-sans text-sm text-muted"
        >
          Collapsed: usually safe to skim. Show anyway
        </button>
      ) : empty ? (
        <p className="px-4 py-3 font-sans text-sm text-muted">
          {file.binary ? "Binary file." : "No content changes (rename or mode change)."}
        </p>
      ) : (
        <div className="font-mono text-[13px] leading-6">
          {stepFile.hunkIndexes.map((hunkIndex) => (
            <HunkBlock key={hunkIndex} file={file} hunkIndex={hunkIndex} context={context} />
          ))}
        </div>
      )}
    </section>
  );
}

export function StepView({ step, context }: { step: Step; context: StepViewContext }) {
  return (
    <div className="flex flex-col gap-4">
      {step.files.map((stepFile) => (
        <FileBlock
          key={`${step.id}:${stepFile.path}`}
          stepFile={stepFile}
          context={context}
          collapsed={step.role === "generated"}
        />
      ))}
    </div>
  );
}
