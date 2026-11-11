import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Geist: vi.fn((options: { variable: string }) => ({ variable: options.variable })),
  Geist_Mono: vi.fn((options: { variable: string }) => ({ variable: options.variable })),
  Atkinson_Hyperlegible_Next: vi.fn(() => ({ variable: "atkinson-sans-variable" })),
  Atkinson_Hyperlegible_Mono: vi.fn(() => ({ variable: "atkinson-mono-variable" })),
}));

function htmlClassNames(): string[] {
  const htmlElement = RootLayout({ children: null });
  return String(htmlElement.props.className).split(" ");
}

describe("RootLayout fonts", () => {
  it("puts the Geist sans variable on the html element", () => {
    expect(htmlClassNames()).toContain("--font-geist-sans");
  });

  it("puts the Geist Mono variable on the html element", () => {
    expect(htmlClassNames()).toContain("--font-geist-mono");
  });

  it("no longer puts Atkinson on the html element", () => {
    expect(htmlClassNames().some((name) => name.startsWith("atkinson"))).toBe(false);
  });
});
