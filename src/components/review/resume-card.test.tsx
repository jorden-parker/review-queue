import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ContextSymbol } from "@/lib/session/store";
import { emptySession } from "@/test/review-fixture";
import { ResumeCard } from "./resume-card";

function symbol(name: string, pinned: boolean): ContextSymbol {
  return {
    name,
    kind: "function",
    path: "src/a.ts",
    line: 1,
    scope: "repo",
    signature: "",
    stepId: null,
    pinned,
    seenAt: "",
    origin: { name, path: "src/a.ts", line: 1, character: 0, side: "new" },
  };
}

describe("ResumeCard", () => {
  it("lists the names you pinned so they come back after a pause", () => {
    render(
      <ResumeCard
        session={emptySession({
          contextSymbols: [symbol("load", true), symbol("noise", false), symbol("Options", true)],
        })}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText("You pinned")).toBeTruthy();
    expect(screen.getByText("load, Options")).toBeTruthy();
  });
});
