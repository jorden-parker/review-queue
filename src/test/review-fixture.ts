import type { PullRequest } from "@/lib/github/gh";
import type { PreparedFile, ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import type { Hunk } from "@/lib/types";

export const REF = { owner: "acme", repo: "app", number: 7 };
export const HEAD_SHA = "5".repeat(40);

export function emptySession(overrides: Partial<Session> = {}): Session {
  return {
    currentStepId: null,
    lastHeadSha: HEAD_SHA,
    updatedAt: null,
    pause: null,
    doneSteps: [],
    checkedHotspots: [],
    notes: [],
    jumps: [],
    ...overrides,
  };
}

function hunk(newStart: number, texts: string[]): Hunk {
  return {
    header: "",
    oldStart: newStart,
    newStart,
    lines: texts.map((text, offset) => ({
      kind: "add",
      text,
      oldLine: null,
      newLine: newStart + offset,
    })),
  };
}

function file(path: string, hunks: Hunk[]): PreparedFile {
  const additions = hunks.reduce((sum, item) => sum + item.lines.length, 0);
  return {
    path,
    oldPath: path,
    status: "modified",
    binary: false,
    additions,
    deletions: 0,
    hunks,
    navigable: true,
    highlighted: hunks.map((item) =>
      item.lines.map((line) => [{ text: line.text, light: "#000", dark: "#fff" }]),
    ),
  };
}

const PULL_REQUEST: PullRequest = {
  ref: REF,
  title: "Add retrying client",
  body: "Retries failed loads.\n\nMore detail.",
  bodyHtml: "<p>Retries failed loads.</p><p>More detail.</p>",
  url: "https://github.com/acme/app/pull/7",
  author: "sam",
  baseRef: "main",
  baseSha: "base1",
  headRef: "retry",
  headSha: HEAD_SHA,
  additions: 3,
  deletions: 0,
  changedFiles: 2,
};

export function reviewPayload(session: Session = emptySession()): ReviewPayload {
  return {
    pr: PULL_REQUEST,
    headSha: HEAD_SHA,
    files: [
      file("src/types.ts", [hunk(1, ["export type Options = { retries: number };"])]),
      file("src/client.ts", [
        hunk(10, ["export function load(options: Options) {", "  console.log(options);"]),
      ]),
      file("pnpm-lock.yaml", [hunk(1, ["lock: 1"])]),
    ],
    steps: [
      {
        id: "types:src/types.ts:0",
        title: "types.ts",
        role: "types",
        reason: "Shapes first.",
        changedLines: 1,
        files: [{ path: "src/types.ts", hunkIndexes: [0] }],
      },
      {
        id: "core:src/client.ts:0",
        title: "client.ts",
        role: "core",
        reason: "The main logic.",
        changedLines: 2,
        files: [{ path: "src/client.ts", hunkIndexes: [0] }],
      },
      {
        id: "generated:pnpm-lock.yaml:0",
        title: "pnpm-lock.yaml",
        role: "generated",
        reason: "Skim.",
        changedLines: 1,
        files: [{ path: "pnpm-lock.yaml", hunkIndexes: [0] }],
      },
    ],
    startStepId: "types:src/types.ts:0",
    hotspots: [
      {
        id: "debug-output:src/client.ts:11",
        rule: "debug-output",
        severity: "low",
        path: "src/client.ts",
        line: 11,
        title: "Debug output left in",
        why: "Remove it.",
      },
    ],
    linkableNames: ["Options", "load"],
    estimateMinutes: 2,
    session,
    reopenedStepIds: [],
  };
}
