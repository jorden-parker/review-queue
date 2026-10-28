import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownField } from "./markdown-field";

function Harness({ initial, onKeyDown }: { initial: string; onKeyDown?: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <MarkdownField
      aria-label="Note"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

function showPreview() {
  fireEvent.click(screen.getByRole("radio", { name: "Preview" }));
}

describe("MarkdownField", () => {
  it("starts as a text box you can type in", () => {
    render(<Harness initial="" />);
    const box = screen.getByRole("textbox", { name: "Note" });
    fireEvent.change(box, { target: { value: "Hello" } });
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveProperty("value", "Hello");
  });

  it("shows the text formatted as Markdown in preview", () => {
    render(<Harness initial="Rename **this** in `load`" />);
    showPreview();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("this").tagName).toBe("STRONG");
    expect(screen.getByText("load").tagName).toBe("CODE");
  });

  it("says when there is nothing to preview", () => {
    render(<Harness initial="  " />);
    showPreview();
    expect(screen.getByText("Nothing to preview")).toBeTruthy();
  });

  it("goes back to writing with the text kept and the box focused", () => {
    render(<Harness initial="Kept" />);
    showPreview();
    fireEvent.click(screen.getByRole("radio", { name: "Write" }));
    const box = screen.getByRole("textbox", { name: "Note" });
    expect(box).toHaveProperty("value", "Kept");
    expect(document.activeElement).toBe(box);
  });

  it("stays in preview when the selected mode is clicked again", () => {
    render(<Harness initial="Kept" />);
    showPreview();
    showPreview();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("passes key presses on in both modes so save and cancel keys keep working", () => {
    const onKeyDown = vi.fn();
    render(<Harness initial="Kept" onKeyDown={onKeyDown} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Note" }), { key: "Escape" });
    showPreview();
    fireEvent.keyDown(screen.getByRole("radio", { name: "Preview" }), { key: "Escape" });
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });
});
