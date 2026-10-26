import { fireEvent, render, screen } from "@testing-library/react";
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

function renderPeek(definitions: DefinitionWithCode[], overrides: Partial<PeekState> = {}) {
  const peek: PeekState = {
    position: POSITION,
    tab: "definitions",
    definitions,
    references: null,
    error: null,
    ...overrides,
  };
  const onGoTo = vi.fn();
  render(
    <PeekPanel
      peek={peek}
      inPullRequest={() => true}
      onIdentifier={vi.fn()}
      onGoTo={onGoTo}
      onTab={vi.fn()}
      pinned={false}
      onTogglePin={vi.fn()}
      onClose={vi.fn()}
    />,
    { wrapper: TooltipProvider },
  );
  return onGoTo;
}

describe("PeekPanel", () => {
  it("names the symbol when going to its definition in this PR", () => {
    const onGoTo = renderPeek([definition({ line: 9 })]);
    fireEvent.click(screen.getByRole("button", { name: /In this PR/ }));
    expect(onGoTo).toHaveBeenCalledWith({ path: "src/app.ts", line: 9, name: "total" });
  });

  it("names the symbol when going to a reference", () => {
    const onGoTo = renderPeek([], {
      tab: "references",
      references: [
        { path: "src/use.ts", line: 12, text: "total + 1", tokens: [{ text: "total + 1" }] },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /12/ }));
    expect(onGoTo).toHaveBeenCalledWith({ path: "src/use.ts", line: 12, name: "total" });
  });

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
