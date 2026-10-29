import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { memo } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ReviewComment } from "@/lib/github/gh";
import type { FileLines } from "@/lib/review/file-lines";
import type { PreparedFile } from "@/lib/review/prepare";
import type { Hunk, Note, Step } from "@/lib/types";
import { reviewPayload } from "@/test/review-fixture";
import { CodeLineComponent } from "./code-line";
import type { Thread } from "./conversation-threads";
import type { DisplayHotspot } from "./hotspot-list";
import { StepView, type StepViewContext } from "./step-view";

vi.mock("./code-line", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./code-line")>();
  const CodeLineComponentMock = vi.fn(actual.CodeLineComponent);
  return {
    ...actual,
    CodeLineComponent: CodeLineComponentMock,
    CodeLine: memo(CodeLineComponentMock),
  };
});

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

const CLIENT_NOTE: Note = {
  id: 1,
  path: "src/client.ts",
  line: 11,
  side: "new",
  startLine: null,
  kind: "issue",
  decorations: [],
  body: "Log the options once",
  createdAt: "2026-10-28T10:00:00Z",
};

const CLIENT_HOTSPOT: DisplayHotspot = {
  id: "debug-output:src/client.ts:11",
  rule: "debug-output",
  severity: "low",
  path: "src/client.ts",
  line: 11,
  title: "Debug output left in",
  why: "Remove it.",
};

function reviewComment(overrides: Partial<ReviewComment>): ReviewComment {
  return {
    id: 1,
    inReplyTo: null,
    path: "src/client.ts",
    line: 11,
    side: "RIGHT",
    author: "sam",
    body: "Should this log?",
    url: "https://github.com/acme/app/pull/7#discussion_r1",
    createdAt: "2026-10-28T10:00:00Z",
    ...overrides,
  };
}

function lineRow(lineIndex: number): HTMLElement {
  const row = document.querySelector<HTMLElement>(
    `[data-path="src/client.ts"][data-line="${lineIndex}"]`,
  );
  if (!row) throw new Error(`no diff row for line index ${lineIndex}`);
  return row;
}

function lineBlock(lineIndex: number): HTMLElement {
  return lineRow(lineIndex).closest<HTMLElement>(".group")!.parentElement!;
}

function fileWithRemoval(): PreparedFile {
  const base = reviewPayload().files.find((file) => file.path === "src/client.ts")!;
  const removal: Hunk = {
    header: "",
    oldStart: 10,
    newStart: 10,
    lines: [
      { kind: "del", text: "  old();", oldLine: 10, newLine: null },
      { kind: "add", text: "  new();", oldLine: null, newLine: 10 },
    ],
  };
  return {
    ...base,
    hunks: [removal],
    highlighted: [
      [
        [{ text: "  old();", light: "#000", dark: "#fff" }],
        [{ text: "  new();", light: "#000", dark: "#fff" }],
      ],
    ],
  };
}

function contextWithRemoval(overrides: Partial<StepViewContext> = {}): StepViewContext {
  const context = contextFor(async () => fileLines());
  context.files.set("src/client.ts", fileWithRemoval());
  return { ...context, ...overrides };
}

describe("notes on deleted lines", () => {
  it("offers an add-note button on a deleted line that targets its old side", async () => {
    const context = contextWithRemoval();
    const { user } = renderStep(CLIENT_STEP, context);
    await user.click(within(lineRow(0)).getByTitle(/Add a note/));
    expect(context.handlers.onAddNote).toHaveBeenCalledWith({
      path: "src/client.ts",
      line: 10,
      side: "old",
    });
  });

  it("shows an old-side note on the deleted line and not on the added line with its number", () => {
    const removedNote: Note = {
      ...CLIENT_NOTE,
      id: 2,
      line: 10,
      side: "old",
      body: "Why was this removed?",
    };
    renderStep(CLIENT_STEP, contextWithRemoval({ notes: [removedNote] }));
    expect(within(lineBlock(0)).getByText("Why was this removed?")).toBeTruthy();
    expect(within(lineBlock(1)).queryByText("Why was this removed?")).toBeNull();
  });

  it("opens the composer under the deleted line and saves the note on the old side", async () => {
    const context = contextWithRemoval({
      composer: { path: "src/client.ts", line: 10, side: "old" },
    });
    const { user } = renderStep(CLIENT_STEP, context);
    await user.type(within(lineBlock(0)).getByRole("textbox"), "why was this removed?");
    await user.click(within(lineBlock(0)).getByRole("button", { name: "Save note" }));
    expect(context.handlers.onSaveNote).toHaveBeenCalledWith(
      { path: "src/client.ts", line: 10, side: "old" },
      expect.any(Object),
      "why was this removed?",
    );
    expect(within(lineBlock(1)).queryByRole("textbox")).toBeNull();
  });
});

describe("places annotations on their own line", () => {
  it("shows a note on its own line only", () => {
    renderStep(CLIENT_STEP, { ...contextFor(async () => fileLines()), notes: [CLIENT_NOTE] });
    expect(within(lineBlock(1)).getByText("Log the options once")).toBeTruthy();
    expect(within(lineBlock(0)).queryByText("Log the options once")).toBeNull();
  });

  it("shows a hotspot on its own line only", () => {
    renderStep(CLIENT_STEP, {
      ...contextFor(async () => fileLines()),
      hotspots: [CLIENT_HOTSPOT],
    });
    expect(within(lineBlock(1)).getByText("Debug output left in")).toBeTruthy();
    expect(within(lineBlock(0)).queryByText("Debug output left in")).toBeNull();
  });

  it("shows a thread count on the right-side line only", () => {
    const threads: Thread[] = [
      { root: reviewComment({ id: 1, line: 11, side: "RIGHT" }), replies: [], outdated: false },
      { root: reviewComment({ id: 2, line: 10, side: "LEFT" }), replies: [], outdated: false },
    ];
    renderStep(CLIENT_STEP, { ...contextFor(async () => fileLines()), threads });
    expect(within(lineRow(1)).getByRole("button", { name: "Show 1 GitHub thread" })).toBeTruthy();
    expect(within(lineRow(0)).queryByRole("button", { name: /GitHub thread/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /GitHub thread/ })).toHaveLength(1);
  });
});

describe("StepView re-renders", () => {
  it("does not re-render lines when only the active hunk changes", () => {
    const context = contextFor(async () => fileLines());
    const { rerender } = render(<StepView step={CLIENT_STEP} context={context} />);
    vi.mocked(CodeLineComponent).mockClear();
    rerender(<StepView step={CLIENT_STEP} context={{ ...context, activeHunkId: "some-hunk" }} />);
    expect(vi.mocked(CodeLineComponent)).not.toHaveBeenCalled();
  });
});
