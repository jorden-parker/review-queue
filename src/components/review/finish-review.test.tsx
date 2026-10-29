import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FileDiff, Note } from "@/lib/types";
import { HEAD_SHA } from "@/test/review-fixture";
import { FinishReview } from "./finish-review";

function file(path: string, newLines: number[]): FileDiff {
  return {
    path,
    oldPath: path,
    status: "modified",
    binary: false,
    additions: newLines.length,
    deletions: 0,
    hunks: [
      {
        header: "",
        oldStart: 1,
        newStart: newLines[0] ?? 1,
        lines: newLines.map((newLine) => ({ kind: "add", text: "", oldLine: null, newLine })),
      },
    ],
  };
}

function note(overrides: Partial<Note>): Note {
  return {
    side: "new",
    startLine: null,
    id: 1,
    path: null,
    line: null,
    kind: "nitpick",
    decorations: [],
    body: "x",
    createdAt: "",
    ...overrides,
  };
}

function renderDialog({
  notes = [],
  stepsLeft = 0,
  hotspotsLeft = 0,
  files = [file("a.ts", [2])],
}: {
  notes?: Note[];
  stepsLeft?: number;
  hotspotsLeft?: number;
  files?: FileDiff[];
}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <FinishReview
      notes={notes}
      stepsLeft={stepsLeft}
      hotspotsLeft={hotspotsLeft}
      headSha={HEAD_SHA}
      files={files}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />,
  );
  return { onSubmit };
}

describe("FinishReview", () => {
  it("renders each postable note's Markdown", () => {
    renderDialog({ notes: [note({ id: 2, kind: "nitpick", body: "Rename `foo`" })] });
    expect(screen.getByText("foo").tagName).toBe("CODE");
  });

  it("shows a note the way it will post, with its label in bold", () => {
    renderDialog({
      notes: [note({ id: 2, kind: "issue", decorations: ["blocking"], body: "leaks" })],
    });
    const label = screen.getByText("issue (blocking):");
    expect(label.tagName).toBe("STRONG");
    expect(label.parentElement?.textContent).toContain("issue (blocking): leaks");
  });

  it("keeps parked notes out of the checklist", () => {
    renderDialog({
      notes: [
        note({ id: 2, kind: "nitpick", body: "rename this" }),
        note({ id: 3, kind: "parked", body: "lunch plans" }),
      ],
      stepsLeft: 1,
    });
    expect(screen.getByText("rename this")).toBeTruthy();
    expect(screen.queryByText("lunch plans")).toBeNull();
    expect(screen.getByText(/1 parked note won’t be posted/)).toBeTruthy();
  });

  it("preselects Approve when everything is ticked and nothing blocks", () => {
    renderDialog({ notes: [] });
    expect(screen.getByRole("button", { name: "Approve on GitHub" })).toBeTruthy();
    expect(screen.getByText("Every step and hotspot is ticked off.")).toBeTruthy();
  });

  it("defaults to Comment while steps remain", () => {
    renderDialog({ stepsLeft: 2 });
    expect(screen.getByRole("button", { name: "Post comment to GitHub" })).toBeTruthy();
    expect(screen.getByText(/Heads up: 2 steps are not ticked off yet./)).toBeTruthy();
  });

  it("defaults to Request changes when a blocker exists", () => {
    renderDialog({
      notes: [note({ id: 2, kind: "issue", decorations: ["blocking"], body: "this leaks" })],
    });
    expect(screen.getByRole("button", { name: "Request changes on GitHub" })).toBeTruthy();
  });

  it("submits only the selected postable ids", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      notes: [
        note({ id: 2, kind: "nitpick", body: "rename" }),
        note({ id: 3, kind: "parked", body: "lunch" }),
      ],
    });
    await user.click(screen.getByRole("button", { name: "Approve on GitHub" }));
    expect(onSubmit).toHaveBeenCalledWith("APPROVE", "", [2]);
  });

  it("unchecks a note whose line left the diff and says why", async () => {
    const user = userEvent.setup();
    const stale = note({ id: 7, path: "a.ts", line: 40, body: "old line" });
    const fine = note({ id: 8, path: "a.ts", line: 2, body: "still here" });
    const { onSubmit } = renderDialog({ notes: [stale, fine], stepsLeft: 1 });
    expect(screen.getByText(/a line the diff no longer has/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Notes to post \(1\)/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Post comment to GitHub/ }));
    expect(onSubmit).toHaveBeenCalledWith("COMMENT", "", [8]);
  });

  it("shows the server's refusal when a post is rejected", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      notes: [note({ id: 2, kind: "nitpick", body: "rename" })],
    });
    onSubmit.mockRejectedValueOnce(
      new Error("These notes point at a line the diff no longer has: a.ts:99. Deselect them."),
    );
    await user.click(screen.getByRole("button", { name: "Approve on GitHub" }));
    expect(await screen.findByText(/a\.ts:99/)).toBeTruthy();
  });
});
