"use client";

import type { ReferenceCount } from "@/lib/types";

function countLabel(count: number): string {
  return count === 1 ? "1 reference" : `${count} references`;
}

function leadingWhitespace(text: string): string {
  return text.match(/^\s*/)?.[0] ?? "";
}

export function ReferenceLens({
  reference,
  lineText,
  onShow,
}: {
  reference: ReferenceCount;
  lineText: string;
  onShow: (reference: ReferenceCount) => void;
}) {
  return (
    <div className="flex font-sans text-xs leading-5 text-muted-foreground select-none">
      <span className="w-12 shrink-0" />
      <span className="w-12 shrink-0" />
      <span className="w-6 shrink-0" />
      <span className="w-4 shrink-0" />
      <span className="min-w-0 flex-1 pr-4 font-mono text-code break-words whitespace-pre-wrap">
        {leadingWhitespace(lineText)}
        <button
          type="button"
          aria-label={`${countLabel(reference.count)} to ${reference.name}`}
          onClick={() => onShow(reference)}
          className="font-sans text-xs transition-colors duration-150 hover:text-foreground hover:underline focus-visible:text-foreground"
        >
          {countLabel(reference.count)}
        </button>
      </span>
    </div>
  );
}
