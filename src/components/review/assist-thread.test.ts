import { describe, expect, it } from "vitest";
import { MAX_HISTORY_TURNS } from "@/lib/assist-protocol";
import {
  askedThread,
  canFollowUp,
  openThread,
  threadRequest,
  withFollowUp,
  withModelText,
} from "./assist-thread";

const RANGE = { path: "src/a.ts", from: { hunk: 0, line: 0 }, to: { hunk: 0, line: 2 } };

describe("openThread", () => {
  it("starts explain right away with the action as the reviewer's turn", () => {
    const thread = openThread(RANGE, "explain");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Explain these lines" }]);
    expect(threadRequest(thread)).toEqual({
      action: "explain",
      path: "src/a.ts",
      from: RANGE.from,
      to: RANGE.to,
      question: null,
      history: [],
    });
  });

  it("waits for the reviewer's words before a comment or question", () => {
    expect(openThread(RANGE, "comment").turns).toEqual([]);
    const thread = askedThread(openThread(RANGE, "ask"), "Why three?");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Why three?" }]);
    expect(threadRequest(thread)).toMatchObject({ action: "ask", question: "Why three?" });
  });
});

describe("follow-ups", () => {
  it("send the conversation after the first turn as history", () => {
    const answered = withModelText(openThread(RANGE, "explain"), "It sets a.");
    const thread = withFollowUp(answered, "Why?");
    expect(threadRequest(thread).history).toEqual([
      { role: "assistant", content: "It sets a." },
      { role: "user", content: "Why?" },
    ]);
  });

  it("replace the model's turn as more text streams in", () => {
    const first = withModelText(openThread(RANGE, "explain"), "It");
    expect(withModelText(first, "It sets a.").turns.at(-1)).toEqual({
      role: "model",
      text: "It sets a.",
    });
  });

  it("stop before the history would be too long for the server", () => {
    let thread = withModelText(openThread(RANGE, "explain"), "a");
    let longest = 0;
    while (canFollowUp(thread)) {
      const asked = withFollowUp(thread, "more?");
      longest = threadRequest(asked).history.length;
      thread = withModelText(asked, "a");
    }
    expect(longest).toBe(MAX_HISTORY_TURNS);
  });
});
