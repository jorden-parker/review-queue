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

function openThread(target: AssistTarget, action: AssistAction) {
  return openThreadAt(target, action, HEAD);
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

describe("follow-ups", () => {
  it("send the conversation after the first turn as history", () => {
    const answered = withModelText(openThread(LINES, "explain"), "It sets a.");
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
