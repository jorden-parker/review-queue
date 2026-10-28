import { describe, expect, it } from "vitest";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import { shouldGreet } from "./use-workspace";

const NOW = Date.parse("2026-10-26T12:00:00Z");
const EMPTY: Session = {
  currentStepId: null,
  lastHeadSha: null,
  baselineHeadSha: null,
  updatedAt: null,
  pause: null,
  doneSteps: [],
  checkedHotspots: [],
  notes: [],
  jumps: [],
  assistThreads: [],
  contextSymbols: [],
  submissions: [],
  replyReceipts: [],
};

function review(session: Partial<Session>, reopenedStepIds: string[] = []): ReviewPayload {
  return { session: { ...EMPTY, ...session }, reopenedStepIds } as ReviewPayload;
}

describe("shouldGreet", () => {
  it("greets after a pause or when commits reopened steps", () => {
    expect(shouldGreet(review({ pause: { note: "x", at: "" } }), NOW)).toBe(true);
    expect(shouldGreet(review({}, ["s1"]), NOW)).toBe(true);
  });

  it("greets when progress is older than half an hour", () => {
    expect(shouldGreet(review({ doneSteps: ["s1"], updatedAt: "2026-10-26T11:00:00Z" }), NOW)).toBe(
      true,
    );
    expect(shouldGreet(review({ doneSteps: ["s1"], updatedAt: "2026-10-26T11:50:00Z" }), NOW)).toBe(
      false,
    );
    expect(shouldGreet(review({ updatedAt: "2026-10-26T09:00:00Z" }), NOW)).toBe(false);
  });
});
