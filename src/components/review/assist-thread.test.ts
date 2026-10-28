import { describe, expect, it } from "vitest";
import { type AssistAction, type AssistTarget, MAX_HISTORY_TURNS } from "@/lib/assist-protocol";
import {
  actionLabel,
  askedThread,
  canFollowUp,
  hasModelReply,
  openThread as openThreadAt,
  questionPrompt,
  threadRequest,
  withFollowUp,
  withModelText,
} from "./assist-thread";

const HEAD = "a".repeat(40);
const RANGE = { path: "src/a.ts", from: { hunk: 0, line: 0 }, to: { hunk: 0, line: 2 } };
const LINES = { kind: "lines" as const, range: RANGE };
const WHOLE_FILE = { kind: "file" as const, path: "src/a.ts" };
const CHECK_TARGET = { kind: "check" as const, stepId: "s1", check: 0, path: "src/a.ts" };

function openThread(target: AssistTarget, action: AssistAction, opener?: string) {
  return openThreadAt(target, action, HEAD, opener);
}

describe("openThread", () => {
  it("starts explain right away with the action as the reviewer's turn", () => {
    const thread = openThread(LINES, "explain");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Explain these lines" }]);
    expect(threadRequest(thread)).toEqual({
      action: "explain",
      target: LINES,
      question: null,
      history: [],
    });
  });

  it("starts a flag check right away", () => {
    const thread = openThread(LINES, "check");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Check the flag on these lines" }]);
  });

  it("gives each thread its own id and the commit it was asked on", () => {
    const first = openThread(LINES, "explain");
    expect(first.headSha).toBe(HEAD);
    expect(first.id).not.toBe(openThread(LINES, "explain").id);
  });

  it("asks about a whole file", () => {
    const thread = openThread(WHOLE_FILE, "explain");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Explain this file" }]);
    expect(threadRequest(thread).target).toEqual(WHOLE_FILE);
  });

  it("waits for the reviewer's words before a comment or question", () => {
    expect(openThread(LINES, "comment").turns).toEqual([]);
    const thread = askedThread(openThread(LINES, "ask"), "Why three?");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Why three?" }]);
    expect(threadRequest(thread)).toMatchObject({ action: "ask", question: "Why three?" });
  });
});

describe("openers", () => {
  it("show the opener as the reviewer's first turn and send no history", () => {
    const thread = openThread(CHECK_TARGET, "explain", "Tell me more: Is eviction bounded?");
    expect(thread.turns).toEqual([
      { role: "reviewer", text: "Tell me more: Is eviction bounded?" },
    ]);
    expect(threadRequest(thread).history).toEqual([]);
  });
});

describe("follow-ups", () => {
  it("send the conversation after the first turn as history", () => {
    const answered = withModelText(openThread(LINES, "explain"), "It sets a.");
    const thread = withFollowUp(answered, "Why?");
    expect(threadRequest(thread).history).toEqual([
      { role: "assistant", content: "It sets a." },
      { role: "user", content: "Why?" },
    ]);
  });

  it("keep lookups on the model's turn but never send them back as history", () => {
    const lookup = { tool: "find_references", label: "Callers of `a` (1)", paths: ["src/b.ts"] };
    const answered = withModelText(openThread(LINES, "explain"), "It sets a.", [lookup]);
    expect(answered.turns.at(-1)).toEqual({ role: "model", text: "It sets a.", lookups: [lookup] });
    const thread = withFollowUp(answered, "Why?");
    expect(threadRequest(thread).history).toEqual([
      { role: "assistant", content: "It sets a." },
      { role: "user", content: "Why?" },
    ]);
  });

  it("replace the model's turn as more text streams in", () => {
    const first = withModelText(openThread(LINES, "explain"), "It");
    expect(withModelText(first, "It sets a.").turns.at(-1)).toEqual({
      role: "model",
      text: "It sets a.",
    });
  });

  it("stop before the history would be too long for the server", () => {
    let thread = withModelText(openThread(LINES, "explain"), "a");
    let longest = 0;
    while (canFollowUp(thread)) {
      const asked = withFollowUp(thread, "more?");
      longest = threadRequest(asked).history.length;
      thread = withModelText(asked, "a");
    }
    expect(longest).toBe(MAX_HISTORY_TURNS);
  });
});

describe("labels", () => {
  it("name a step check", () => {
    expect(actionLabel("explain", CHECK_TARGET)).toBe("Explain this check");
    expect(actionLabel("ask", CHECK_TARGET)).toBe("Ask about this check");
  });

  it("name lines or a whole file", () => {
    expect(actionLabel("simplify", LINES)).toBe("Simplify these lines");
    expect(actionLabel("simplify", WHOLE_FILE)).toBe("Simplify this file");
    expect(questionPrompt("comment", WHOLE_FILE)).toBe("What worries you about this file?");
    expect(questionPrompt("explain", WHOLE_FILE)).toBeNull();
  });
});

describe("hasModelReply", () => {
  it("is true once the model has written something", () => {
    const thread = openThread(LINES, "explain");
    expect(hasModelReply(thread)).toBe(false);
    expect(hasModelReply(withModelText(thread, " "))).toBe(false);
    expect(hasModelReply(withModelText(thread, "It sets a."))).toBe(true);
  });
});
