import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader, PageShell } from "./page-shell";

describe("PageShell", () => {
  it("renders its children inside a main landmark", () => {
    render(
      <PageShell>
        <p>Body content</p>
      </PageShell>,
    );
    const main = screen.getByRole("main");
    expect(main.contains(screen.getByText("Body content"))).toBe(true);
  });
});

describe("PageHeader", () => {
  it("renders the title as the page heading", () => {
    render(<PageHeader title="Settings" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Settings");
  });

  it("renders the lede when given", () => {
    render(<PageHeader title="Settings" lede="Saved here." />);
    expect(screen.getByText("Saved here.").tagName).toBe("P");
  });

  it("renders the action node when given", () => {
    render(<PageHeader title="Settings" action={<button type="button">Reset</button>} />);
    expect(screen.getByRole("button", { name: "Reset" }).tagName).toBe("BUTTON");
  });

  it("renders a back link with its label and href when asked", () => {
    render(<PageHeader title="Settings" backHref="/" backLabel="Review queue" />);
    expect(screen.getByRole("link", { name: "Review queue" }).getAttribute("href")).toBe("/");
  });
});
