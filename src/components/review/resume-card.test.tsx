import { fireEvent, render, screen } from "@testing-library/react";
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
        onShowChanges={vi.fn()}
      />,
    );
    expect(screen.getByText("You pinned")).toBeTruthy();
    expect(screen.getByText("load, Options")).toBeTruthy();
  });

  it("renders the pause note's Markdown inline", () => {
    render(
      <ResumeCard
        session={emptySession({ pause: { note: "Check **retry** in `load`", at: "" } })}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
        onShowChanges={vi.fn()}
      />,
    );
    expect(screen.getByText("retry").tagName).toBe("STRONG");
    expect(screen.getByText("load").tagName).toBe("CODE");
  });

  it("renders the last note's Markdown inline", () => {
    render(
      <ResumeCard
        session={emptySession({
          notes: [
            {
              side: "new",
              startLine: null,
              id: 9,
              path: null,
              line: null,
              kind: "nitpick",
              decorations: [],
              body: "Rename `foo`",
              createdAt: "",
            },
          ],
        })}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
        onShowChanges={vi.fn()}
      />,
    );
    expect(screen.getByText("foo").tagName).toBe("CODE");
  });

  it("offers to show what changed only when a baseline was kept", () => {
    const onShowChanges = vi.fn();
    const { rerender } = render(
      <ResumeCard
        session={emptySession({ baselineHeadSha: "4".repeat(40) })}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
        onShowChanges={onShowChanges}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show what changed" }));
    expect(onShowChanges).toHaveBeenCalledOnce();

    rerender(
      <ResumeCard
        session={emptySession()}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
        onShowChanges={onShowChanges}
      />,
    );
    expect(screen.queryByRole("button", { name: "Show what changed" })).toBeNull();
  });
});
