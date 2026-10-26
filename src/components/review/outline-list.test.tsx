import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { OutlineSymbol } from "@/lib/types";
import { OutlineList, type OutlineFile } from "./outline-list";

function node(
  name: string,
  kind: OutlineSymbol["kind"],
  line: number,
  endLine: number,
  children: OutlineSymbol[] = [],
): OutlineSymbol {
  return { name, kind, path: "src/store.ts", line, endLine, children };
}

const STORE: OutlineFile = {
  path: "src/store.ts",
  symbols: [
    node("Store", "class", 1, 20, [node("load", "method", 2, 5)]),
    node("save", "function", 30, 31),
  ],
  diff: { shown: new Set([2]), changed: new Set([3]) },
};

function renderList(files: OutlineFile[] = [STORE]) {
  const onOpen = vi.fn();
  render(<OutlineList files={files} onOpen={onOpen} />);
  return { onOpen, user: userEvent.setup() };
}

describe("OutlineList", () => {
  it("shows each file's symbols nested under their parents", () => {
    renderList();
    expect(screen.getByTitle("src/store.ts")).toBeTruthy();
    const names = screen.getAllByRole("treeitem").map((item) => item.getAttribute("aria-level"));
    expect(names).toEqual(["1", "2", "1"]);
    expect(screen.getByRole("button", { name: /^load method/ })).toBeTruthy();
  });

  it("collapses and expands a symbol's children", async () => {
    const { user } = renderList();
    await user.click(screen.getByRole("button", { name: "Collapse Store" }));
    expect(screen.queryByRole("button", { name: /^load/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Expand Store" }));
    expect(screen.getByRole("button", { name: /^load/ })).toBeTruthy();
  });

  it("opens a symbol and says whether its line is shown in the step", async () => {
    const { onOpen, user } = renderList();
    await user.click(screen.getByRole("button", { name: /^load/ }));
    await user.click(screen.getByRole("button", { name: /^save/ }));
    expect(onOpen.mock.calls).toEqual([
      [expect.objectContaining({ name: "load" }), true],
      [expect.objectContaining({ name: "save" }), false],
    ]);
  });

  it("marks symbols with changed lines", () => {
    renderList();
    expect(screen.getByRole("button", { name: /^Store class changed/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^save function$/ })).toBeTruthy();
  });

  it("says when a file has no symbols or is still loading", () => {
    renderList([
      { ...STORE, symbols: [] },
      { ...STORE, path: "src/other.ts", symbols: undefined },
    ]);
    expect(screen.getByText("No symbols")).toBeTruthy();
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("explains an empty outline", () => {
    renderList([]);
    expect(screen.getByText(/No code files in this step/)).toBeTruthy();
  });
});
