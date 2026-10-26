import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DiffLine } from "@/lib/types";
import { CodeLine } from "./code-line";
import type { LineTarget } from "./locate";

const LINE: DiffLine = {
  kind: "add",
  text: "const total = sum(items);",
  oldLine: null,
  newLine: 7,
};

function renderLine(landed: LineTarget | null) {
  return render(
    <CodeLine
      path="src/app.ts"
      hunkIndex={0}
      lineIndex={0}
      line={LINE}
      tokens={[{ text: LINE.text }]}
      linked
      hotspots={[]}
      notes={[]}
      elementId="line-src/app.ts-7"
      landed={landed}
      handlers={{
        onIdentifier: vi.fn(),
        onHoverIdentifier: vi.fn(),
        onAddNote: vi.fn(),
        onDeleteNote: vi.fn(),
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
});
