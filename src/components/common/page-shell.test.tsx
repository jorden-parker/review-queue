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

  it("gives the main landmark the id the skip link targets", () => {
    render(
      <PageShell>
        <p>Body content</p>
      </PageShell>,
    );
    expect(screen.getByRole("main").id).toBe("main");
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

  it("draws no decorative backdrop behind the header", () => {
    const { container } = render(<PageHeader title="Settings" />);
    expect(container.querySelector(".bg-grid")).toBeNull();
  });

  it("sets the title at a calm size", () => {
    render(<PageHeader title="Settings" />);
    const classes = screen.getByRole("heading", { level: 1 }).classList;
    expect(classes.contains("text-4xl")).toBe(true);
    expect(classes.contains("text-5xl")).toBe(false);
  });
});
