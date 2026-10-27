import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Callout } from "./callout";

describe("Callout", () => {
  it("renders its children", () => {
    render(<Callout>Saved for later</Callout>);
    expect(screen.getByText("Saved for later")).toBeTruthy();
  });

  it("uses the note tone by default", () => {
    render(<Callout>Note</Callout>);
    const callout = screen.getByText("Note");
    expect(callout.classList).toContain("bg-callout");
    expect(callout.classList).toContain("text-callout-foreground");
  });

  it("uses the error tone when asked", () => {
    render(<Callout tone="error">Failed</Callout>);
    const callout = screen.getByText("Failed");
    expect(callout.classList).toContain("bg-del");
    expect(callout.classList).toContain("text-del-foreground");
  });

  it("uses the muted tone when asked", () => {
    render(<Callout tone="muted">Quiet</Callout>);
    expect(screen.getByText("Quiet").classList).toContain("bg-muted/60");
  });

  it("forwards className and role", () => {
    render(
      <Callout role="status" className="flex-wrap">
        Forwarded
      </Callout>,
    );
    const callout = screen.getByRole("status");
    expect(callout.classList).toContain("flex-wrap");
    expect(callout.textContent).toBe("Forwarded");
  });
});
