import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FileLines } from "@/lib/review/file-lines";
import type { Hunk, Step } from "@/lib/types";
import { reviewPayload } from "@/test/review-fixture";
import { StepView, type StepViewContext } from "./step-view";

const FILE_TEXT = Array.from({ length: 14 }, (_, index) => `line ${index + 1}`);

function fileLines(): FileLines {
  return { tokens: FILE_TEXT.map((text) => [{ text }]), truncated: false };
}

function contextFor(loadFile: StepViewContext["loadFile"]): StepViewContext {
  const files = new Map(reviewPayload().files.map((file) => [file.path, file]));
  return {
    files,
    hotspots: [],
    checkedHotspots: [],
    notes: [],
    threads: [],
    composer: null,
    landed: null,
    occurrences: null,
    activeHunkId: null,
    referenceCounts: new Map(),
    onAskFile: null,
    loadFile,
    handlers: {
      onIdentifier: vi.fn(),
      onHoverIdentifier: vi.fn(),
      onAddNote: vi.fn(),
      onDeleteNote: vi.fn(),
      onToggleHotspot: vi.fn(),
      onCheckFlag: null,
      onSaveNote: vi.fn(),
      onCancelNote: vi.fn(),
      onShowReferences: vi.fn(),
      onOpenConversation: vi.fn(),
    },
  };
}

function code(text: string) {
  return (_: string, element: Element | null) =>
    element?.tagName === "CODE" && element.textContent === text;
}

const CLIENT_STEP = reviewPayload().steps[1];

function renderStep(step: Step = CLIENT_STEP, context = contextFor(async () => fileLines())) {
  render(<StepView step={step} context={context} />);
  return { user: userEvent.setup(), context };
}

function secondHunk(): Hunk {
  return {
    header: "",
    oldStart: 13,
    newStart: 13,
    lines: [{ kind: "add", text: "later change", oldLine: null, newLine: 13 }],
  };
}

describe("StepView context expansion", () => {
  it("expands the unchanged lines above a hunk without note buttons", async () => {
    const { user } = renderStep();
    await user.click(screen.getByRole("button", { name: /Expand 9 lines/ }));
    expect(await screen.findByText(code("line 1"))).toBeTruthy();
    expect(screen.getByText(code("line 9"))).toBeTruthy();
    expect(screen.queryByText(code("line 12"))).toBeNull();
    expect(screen.getAllByTitle(/Add a note/)).toHaveLength(2);
  });

  it("expands to the end of the file once its length is known", async () => {
    const { user } = renderStep();
    await user.click(screen.getByRole("button", { name: /Expand to end of file/ }));
    expect(await screen.findByText(code("line 14"))).toBeTruthy();
    expect(screen.getByRole("button", { name: /Expand 9 lines/ })).toBeTruthy();
  });

  it("shows the whole file, including hunks from other steps", async () => {
    const context = contextFor(async () => fileLines());
    const client = context.files.get("src/client.ts")!;
    context.files.set("src/client.ts", {
      ...client,
      hunks: [...client.hunks, secondHunk()],
      highlighted: [...client.highlighted, [[{ text: "later change" }]]],
    });
    const { user } = renderStep(CLIENT_STEP, context);
    expect(screen.queryByText(code("later change"))).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show whole file" }));
    expect(await screen.findByText(code("line 1"))).toBeTruthy();
    expect(screen.getByText(code("later change"))).toBeTruthy();
    expect(screen.getByText(code("line 14"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Expand/ })).toBeNull();
  });

  it("opens the unchanged lines around a landed line so it can be scrolled to", async () => {
    const context = {
      ...contextFor(async () => fileLines()),
      landed: { path: "src/client.ts", line: 3 },
    };
    renderStep(CLIENT_STEP, context);
    expect(await screen.findByText(code("line 3"))).toBeTruthy();
    const row = document.getElementById("line-src/client.ts-3");
    expect(row?.getAttribute("aria-current")).toBe("location");
  });

  it("offers a retry when the file cannot be loaded", async () => {
    const { user } = renderStep(
      CLIENT_STEP,
      contextFor(() => Promise.reject(new Error("gone"))),
    );
    await user.click(screen.getByRole("button", { name: /Expand 9 lines/ }));
    expect(
      await screen.findAllByRole("button", { name: /Couldn't load the file/ }),
    ).not.toHaveLength(0);
  });
});
