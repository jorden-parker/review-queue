import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PathLabel } from "./path-label";

const LONG_PATH = "src/components/review/very-long-directory/use-step-navigation.ts";

describe("PathLabel", () => {
  it("truncates by default", () => {
    render(<PathLabel path={LONG_PATH} />);
    expect(screen.getByTitle(LONG_PATH).classList).toContain("truncate");
  });

  it("wraps anywhere instead of truncating when asked, so the file name stays visible", () => {
    render(<PathLabel path={LONG_PATH} wrap />);
    const label = screen.getByTitle(LONG_PATH);
    expect(label.classList).not.toContain("truncate");
    expect(label.classList).toContain("wrap-anywhere");
  });
});
