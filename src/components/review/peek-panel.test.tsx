import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { DefinitionWithCode } from "@/lib/review/peek-code";
import { PeekPanel } from "./peek-panel";
import type { PeekState } from "./use-peek";

const POSITION = { name: "total", path: "src/app.ts", line: 3, character: 8, side: "new" as const };

function definition(overrides: Partial<DefinitionWithCode>): DefinitionWithCode {
  return {
    name: "total",
    kind: "constant",
    path: "src/app.ts",
    line: 3,
    endLine: 3,
    lines: ["const total = 1;"],
    tokens: [[{ text: "const total = 1;" }]],
    source: "lsp",
    scope: "file",
    signature: "const total: number",
    hover: null,
    ...overrides,
  };
}

function renderPeek(definitions: DefinitionWithCode[]) {
  const peek: PeekState = {
    position: POSITION,
    tab: "definitions",
    definitions,
    references: null,
    error: null,
  };
  render(
    <PeekPanel
      peek={peek}
      inPullRequest={() => true}
      onIdentifier={vi.fn()}
      onGoTo={vi.fn()}
      onTab={vi.fn()}
      pinned={false}
      onTogglePin={vi.fn()}
      onClose={vi.fn()}
    />,
    { wrapper: TooltipProvider },
  );
}

describe("PeekPanel", () => {
  it("labels where a definition lives", () => {
    renderPeek([definition({})]);
    expect(screen.getByText("this file")).toBeTruthy();
  });

  it("shows library definitions as their hover docs instead of code", () => {
    renderPeek([
      definition({
        path: "lib.dom.d.ts",
        scope: "external",
        lines: [],
        tokens: [],
        hover: "```typescript\nvar console: Console\n```\n\nThe console.",
      }),
    ]);
    expect(screen.getByText("library")).toBeTruthy();
    expect(screen.getByText("The console.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /In this PR/ })).toBeNull();
  });
});
