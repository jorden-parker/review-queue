import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { FileLines } from "@/lib/review/file-lines";
import { FileView } from "./file-view";

const FILE: FileLines = {
  tokens: Array.from({ length: 40 }, (_, index) => [{ text: `row ${index + 1}` }]),
  truncated: false,
};

function code(text: string) {
  return (_: string, element: Element | null) =>
    element?.tagName === "CODE" && element.textContent === text;
}

function renderView(
  overrides: {
    loadFile?: () => Promise<FileLines>;
    line?: number;
    tokens?: FileLines["tokens"];
  } = {},
) {
  const onIdentifier = vi.fn();
  const onClose = vi.fn();
  const loadFile = vi.fn(
    overrides.loadFile ?? (async () => ({ ...FILE, tokens: overrides.tokens ?? FILE.tokens })),
  );
  render(
    <FileView
      target={{ path: "src/store.ts", line: overrides.line ?? 1 }}
      loadFile={loadFile}
      onIdentifier={onIdentifier}
      onClose={onClose}
    />,
    { wrapper: TooltipProvider },
  );
  return { onIdentifier, onClose, loadFile };
}

describe("FileView", () => {
  it("shows every line of a file outside the pull request", async () => {
    const { loadFile } = renderView();
    expect(await screen.findByText(code("row 40"))).toBeTruthy();
    expect(loadFile).toHaveBeenCalledWith("src/store.ts");
    expect(screen.getByText("Read only · not in this PR")).toBeTruthy();
  });

  it("highlights the line it was opened at", async () => {
    renderView({ line: 30 });
    await screen.findByText(code("row 30"));
    expect(screen.getByText(code("row 30")).closest("div")?.className).toMatch(/bg-primary\/10/);
    expect(screen.getByText(code("row 29")).closest("div")?.className).not.toMatch(
      /bg-primary\/10/,
    );
  });

  it("peeks an identifier at its position in the file", async () => {
    const { onIdentifier } = renderView({
      line: 2,
      tokens: [[{ text: "const x = 1;" }], [{ text: "return total;" }]],
    });
    fireEvent.click(await screen.findByText("total"));
    expect(onIdentifier).toHaveBeenCalledWith(
      expect.objectContaining({ name: "total", path: "src/store.ts", line: 2, side: "new" }),
    );
  });

  it("returns to the review when asked", async () => {
    const { onClose } = renderView();
    await screen.findByText(code("row 1"));
    fireEvent.click(screen.getByRole("button", { name: /Back to the review/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("says when a file could not be read", async () => {
    renderView({ loadFile: async () => Promise.reject(new Error("gone")) });
    expect(await screen.findByText("Could not load the file.")).toBeTruthy();
  });
});
