"use client";

import { cn } from "cn";
import type { Token } from "@/lib/highlight";
import type { SymbolPosition } from "@/lib/types";
import { CodeTokens } from "./code-tokens";

export const WRAPPED_CODE = "min-w-0 flex-1 tab-2 break-words whitespace-pre-wrap wrap-anywhere";

type LineRange = { from: number; to: number };

function scrollToCentre(element: HTMLElement | null) {
  element?.scrollIntoView?.({ block: "center" });
}

export function CodeRows({
  path,
  startLine,
  tokens,
  focus,
  onIdentifier,
}: {
  path: string;
  startLine: number;
  tokens: Token[][];
  focus: LineRange | null;
  onIdentifier: (position: SymbolPosition) => void;
}) {
  const focused = (line: number) => focus !== null && line >= focus.from && line <= focus.to;
  return (
    <pre className="py-2 font-mono text-code">
      {tokens.map((row, index) => {
        const line = startLine + index;
        return (
          <div
            key={index}
            ref={focus?.from === line ? scrollToCentre : undefined}
            className={cn(
              "flex px-3 transition-colors duration-calm hover:bg-muted/60",
              focused(line) && "bg-primary/10",
            )}
          >
            <span className="w-8 shrink-0 pr-3 text-right text-muted-foreground/70 select-none">
              {line}
            </span>
            <code className={WRAPPED_CODE}>
              <CodeTokens
                tokens={row}
                onIdentifier={(target) => onIdentifier({ ...target, path, line, side: "new" })}
              />
            </code>
          </div>
        );
      })}
    </pre>
  );
}
