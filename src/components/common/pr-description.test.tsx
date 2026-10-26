import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrDescription } from "./pr-description";

const IMAGE_SRC = "https://private-user-images.githubusercontent.com/1/shot.png?jwt=abc";

const HTML = [
  '<div class="markdown-heading"><h2 class="heading-element">Summary</h2></div>',
  '<ul dir="auto">',
  "<li><code>format(1e-7)</code> previously produced <code>1e-7ms</code></li>",
  '<li>Align the <a href="https://example.com" rel="nofollow">parse</a> message</li>',
  "</ul>",
  '<p dir="auto">First link<br>Second link</p>',
  `<p dir="auto"><a href="${IMAGE_SRC}"><img src="${IMAGE_SRC}" alt="shot" width="300"></a></p>`,
  '<script>alert(1)</script><p onclick="alert(1)">Click</p>',
].join("\n");

function overflowBy(pixels: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(100 + pixels);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
}

describe("PrDescription", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the description structure GitHub produced", () => {
    render(<PrDescription html={HTML} />);
    expect(screen.getByRole("heading", { name: "Summary" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("format(1e-7)").tagName).toBe("CODE");
    expect(screen.getByRole("link", { name: "parse" }).getAttribute("target")).toBe("_blank");
  });

  it("keeps line breaks", () => {
    render(<PrDescription html={HTML} />);
    expect(screen.getByText(/First link/).querySelector("br")).not.toBeNull();
  });

  it("renders images", () => {
    render(<PrDescription html={HTML} />);
    expect(screen.getByRole("img", { name: "shot" }).getAttribute("src")).toBe(IMAGE_SRC);
  });

  it("strips scripts and event handlers", () => {
    const { container } = render(<PrDescription html={HTML} />);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("Click").getAttribute("onclick")).toBeNull();
  });

  it("offers to expand a long description and collapse it again", () => {
    overflowBy(50);
    render(<PrDescription html={HTML} />);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByRole("button", { name: "Show more" })).toBeTruthy();
  });

  it("hides the toggle when the description fits", () => {
    overflowBy(0);
    render(<PrDescription html={HTML} />);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});
