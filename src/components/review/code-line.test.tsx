import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DiffLine, Note } from "@/lib/types";
import { CodeLine } from "./code-line";
import type { DisplayHotspot } from "./hotspot-list";
import type { LineTarget } from "./locate";

const LINE: DiffLine = {
  kind: "add",
  text: "const total = sum(items);",
  oldLine: null,
  newLine: 7,
};

const NOTE: Note = {
  side: "new",
  startLine: null,
  id: 5,
  path: "src/app.ts",
  line: 7,
  kind: "nitpick",
  decorations: [],
  body: "Rename `foo`",
  createdAt: "",
};

const FLAG: DisplayHotspot = {
  id: "debug-output:src/app.ts:7",
  rule: "debug-output",
  severity: "low",
  path: "src/app.ts",
  line: 7,
  title: "Debug output left in",
  why: "Likely meant to be removed before merging.",
};

function renderLine(
  landed: LineTarget | null,
  hotspots: DisplayHotspot[] = [],
  notes: Note[] = [],
) {
  return render(
    <CodeLine
      path="src/app.ts"
      hunkIndex={0}
      lineIndex={0}
      line={LINE}
      tokens={[{ text: LINE.text }]}
      linked
      hotspots={hotspots}
      checkedHotspots={[]}
      notes={notes}
      threadCount={0}
      onOpenThreads={vi.fn()}
      elementId="line-src/app.ts-7"
      landed={landed}
      handlers={{
        onIdentifier: vi.fn(),
        onHoverIdentifier: vi.fn(),
        onAddNote: vi.fn(),
        onDeleteNote: vi.fn(),
        onToggleHotspot: vi.fn(),
        onCheckFlag: null,
      }}
    />,
  );
}

describe("CodeLine", () => {
  it("marks the line a jump landed on and the symbol it was for", () => {
    const { container } = renderLine({ path: "src/app.ts", line: 7, name: "total" });
    expect(container.querySelector("[aria-current]")?.id).toBe("line-src/app.ts-7");
    expect(screen.getByRole("button", { name: "total" }).querySelector("mark")).toBeTruthy();
  });

  it("marks the line without a symbol when the jump named none", () => {
    const { container } = renderLine({ path: "src/app.ts", line: 7 });
    expect(container.querySelector("[aria-current]")).toBeTruthy();
    expect(container.querySelector("mark")).toBeNull();
  });

  it("leaves other lines unmarked", () => {
    const { container } = renderLine(null);
    expect(container.querySelector("[aria-current]")).toBeNull();
    expect(container.querySelector("mark")).toBeNull();
  });

  it("puts the line's flags on their own row under the code", () => {
    const { container } = renderLine(null, [FLAG]);
    const flags = screen.getByRole("button", { name: /1 flag/ });
    expect(container.querySelector("[data-line]")?.contains(flags)).toBe(false);
    expect(flags.textContent).toBe(FLAG.title);
  });

  it("renders a note's Markdown under the line", () => {
    renderLine(null, [], [{ ...NOTE, body: "Rename `foo`" }]);
    expect(screen.getByText("foo").tagName).toBe("CODE");
  });

  it("keeps the flag row in the same hover group as its line", () => {
    const { container } = renderLine(null, [FLAG]);
    const flags = screen.getByRole("button", { name: /1 flag/ });
    const lineGroup = container.querySelector("[data-line]")?.closest(".group");
    expect(lineGroup?.contains(flags)).toBe(true);
  });
});
