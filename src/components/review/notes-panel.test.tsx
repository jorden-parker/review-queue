import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Note } from "@/lib/types";
import { NotesPanel } from "./notes-panel";

const NIT_NOTE: Note = {
  id: 1,
  path: "a.ts",
  line: 3,
  kind: "nitpick",
  decorations: [],
  body: "typo",
  createdAt: "",
};

const PARKED_NOTE: Note = {
  id: 2,
  path: null,
  line: null,
  kind: "parked",
  decorations: [],
  body: "look later",
  createdAt: "",
};

function renderPanel(notes: Note[], onEdit = vi.fn()) {
  render(
    <NotesPanel
      notes={notes}
      onPark={vi.fn()}
      onOpen={vi.fn()}
      onEdit={onEdit}
      onDelete={vi.fn()}
      parkingRef={{ current: null }}
    />,
  );
  return onEdit;
}

describe("NotesPanel rendering", () => {
  it("renders a note's Markdown as code", () => {
    renderPanel([{ ...NIT_NOTE, body: "Rename `foo`" }]);
    expect(screen.getByText("foo").tagName).toBe("CODE");
  });

  it("keeps a link in the note body out of the open button", () => {
    renderPanel([{ ...NIT_NOTE, body: "see [docs](https://example.com)" }]);
    expect(screen.getByRole("link", { name: "docs" }).closest("button")).toBeNull();
  });
});

describe("NotesPanel editing", () => {
  it("edits a note's text and kind", async () => {
    const onEdit = renderPanel([NIT_NOTE]);
    await userEvent.click(screen.getByRole("button", { name: "Edit note" }));
    const textarea = screen.getByDisplayValue("typo");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "leaks");
    await userEvent.click(screen.getByRole("button", { name: "Issue" }));
    await userEvent.click(screen.getByRole("button", { name: "blocking" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onEdit).toHaveBeenCalledWith(1, { kind: "issue", decorations: ["blocking"] }, "leaks");
  });

  it("keeps a parked note parked", async () => {
    const onEdit = renderPanel([PARKED_NOTE]);
    await userEvent.click(screen.getByRole("button", { name: "Edit note" }));
    expect(screen.queryByRole("button", { name: "Issue" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onEdit).toHaveBeenCalledWith(2, { kind: "parked", decorations: [] }, "look later");
  });

  it("cancels without saving", async () => {
    const onEdit = renderPanel([NIT_NOTE]);
    await userEvent.click(screen.getByRole("button", { name: "Edit note" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("typo")).toBeTruthy();
  });
});
