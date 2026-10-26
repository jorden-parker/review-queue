import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrDescription } from "./pr-description";

const BODY = [
  "## Summary",
  "- `format(1e-7)` previously produced `1e-7ms`",
  "- Align the [parse](https://example.com) message",
  "",
  "<script>alert(1)</script>",
].join("\n");

function overflowBy(pixels: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(100 + pixels);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
}

describe("PrDescription", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the markdown structure without raw HTML", () => {
    const { container } = render(<PrDescription body={BODY} />);
    expect(screen.getByRole("heading", { name: "Summary" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("format(1e-7)").tagName).toBe("CODE");
    expect(screen.getByRole("link", { name: "parse" }).getAttribute("target")).toBe("_blank");
    expect(container.querySelector("script")).toBeNull();
  });

  it("hides HTML comments", () => {
    render(<PrDescription body={"Intro\n\n<!-- hidden note -->"} />);
    expect(screen.queryByText(/hidden note/)).toBeNull();
  });

  it("renders HTML image tags", () => {
    const src = "https://github.com/user-attachments/assets/x";
    render(<PrDescription body={`<img src="${src}" alt="shot" width="300">`} />);
    expect(screen.getByRole("img", { name: "shot" }).getAttribute("src")).toBe(src);
  });

  it("renders markdown images", () => {
    render(<PrDescription body="![diagram](https://example.com/d.png)" />);
    expect(screen.getByRole("img", { name: "diagram" })).toBeTruthy();
  });

  it("offers to expand a long description and collapse it again", () => {
    overflowBy(50);
    render(<PrDescription body={BODY} />);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByRole("button", { name: "Show more" })).toBeTruthy();
  });

  it("hides the toggle when the description fits", () => {
    overflowBy(0);
    render(<PrDescription body={BODY} />);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});
