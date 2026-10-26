import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ContextSymbol } from "@/lib/session/store";
import { ContextList } from "./context-list";

function symbol(overrides: Partial<ContextSymbol>): ContextSymbol {
  return {
    name: "load",
    kind: "function",
    path: "src/a.ts",
    line: 1,
    scope: "repo",
    signature: "function load(id: string)",
    stepId: "s1",
    pinned: false,
    seenAt: "2026-10-26T10:00:00.000Z",
    origin: { name: "load", path: "src/b.ts", line: 2, character: 4, side: "new" },
    ...overrides,
  };
}

const SYMBOLS = [
  symbol({ name: "total", kind: "constant", line: 9, signature: "const total: number" }),
  symbol({ name: "Options", kind: "type", line: 4, stepId: "s2", pinned: true }),
  symbol({ name: "console", kind: "variable", scope: "external", path: "lib.dom.d.ts" }),
];

function renderList(overrides: Partial<Parameters<typeof ContextList>[0]> = {}) {
  const handlers = {
    onOpen: vi.fn(),
    onTogglePin: vi.fn(),
    onBack: vi.fn(),
    onClearTrail: vi.fn(),
  };
  render(
    <ContextList
      symbols={SYMBOLS}
      stepId="s1"
      jumps={[{ name: "load", path: "src/a.ts", line: 3 }]}
      {...handlers}
      {...overrides}
    />,
    { wrapper: TooltipProvider },
  );
  return { user: userEvent.setup(), ...handlers };
}

const rowNames = () =>
  screen.queryAllByRole("button", { name: /^Open / }).map((row) => row.getAttribute("aria-label"));

describe("ContextList", () => {
  it("shows pins first, then everything seen, with signatures", () => {
    renderList();
    expect(rowNames()).toEqual(["Open Options", "Open total", "Open console"]);
    expect(screen.getByText("const total: number")).toBeTruthy();
  });

  it("switches between pinned, this step and all", async () => {
    const { user } = renderList();
    await user.click(screen.getByRole("radio", { name: "Pinned" }));
    expect(rowNames()).toEqual(["Open Options"]);
    await user.click(screen.getByRole("radio", { name: "This step" }));
    expect(rowNames()).toEqual(["Open total", "Open console"]);
  });

  it("hides kinds that are toggled off", async () => {
    const { user } = renderList();
    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("button", { name: "Types" }));
    expect(rowNames()).toEqual(["Open total"]);
  });

  it("opens, pins and walks the trail back", async () => {
    const { user, onOpen, onTogglePin, onBack, onClearTrail } = renderList();
    await user.click(screen.getByRole("button", { name: "Open total" }));
    expect(onOpen).toHaveBeenCalledWith(SYMBOLS[0]);
    await user.click(screen.getByRole("button", { name: "Pin total" }));
    expect(onTogglePin).toHaveBeenCalledWith(SYMBOLS[0]);
    expect(screen.getByRole("button", { name: "Unpin Options" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Back/ }));
    await user.click(screen.getByRole("button", { name: /Forget trail/ }));
    expect(onBack).toHaveBeenCalled();
    expect(onClearTrail).toHaveBeenCalled();
  });

  it("explains itself when nothing matches", () => {
    renderList({ symbols: [], jumps: [] });
    expect(screen.getByText(/Click any name in the diff/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Back/ })).toBeNull();
  });
});
