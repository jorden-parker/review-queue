import { vi } from "vitest";
import type { ReviewEvent } from "@/lib/github/gh";
import { applySessionAction, SessionActionSchema } from "@/lib/review/session-actions";
import { SessionStore } from "@/lib/session/store";
import type { ReviewPayload } from "@/lib/review/prepare";

type Call = { url: string; method: string; body: unknown };

export const ASSIST_REPLY = ["It declares ", "the Options type."];

function streamedText(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

const STEP_EXPLANATION = {
  status: "ready",
  explanation: {
    model: "m",
    what: "Adds the Options type.",
    checks: ["Is retries optional?"],
  },
};

const REFERENCE_COUNTS: Record<string, unknown> = {
  "src/client.ts": [{ name: "load", line: 10, character: 16, count: 2 }],
};

function outlineSymbol(name: string, kind: string, line: number, endLine: number) {
  return { name, kind, path: "src/client.ts", line, endLine, children: [] };
}

const OUTLINES: Record<string, unknown> = {
  "src/client.ts": [
    {
      ...outlineSymbol("load", "function", 10, 12),
      children: [outlineSymbol("attempts", "variable", 11, 11)],
    },
    outlineSymbol("retry", "function", 40, 44),
  ],
};

export const SUBMITTED_REVIEW_URL = "https://github.com/acme/app/pull/7#pullrequestreview-42";

type SubmitBody = { event: ReviewEvent; summary: string; headSha: string };

const EMPTY_CONVERSATION = { comments: [], reviews: [], truncated: false };

export function installFakeApi(
  payload: ReviewPayload,
  orientation: unknown = { status: "disabled" },
  explanations: unknown[] = [],
  changes: unknown = { baselineHeadSha: payload.headSha, headSha: payload.headSha, files: [] },
  conversation: unknown = EMPTY_CONVERSATION,
) {
  const store = new SessionStore(":memory:");
  const calls: Call[] = [];
  const head = { current: payload.headSha };
  const key = "acme/app#7";
  const routes: [RegExp, (body: unknown, url: URL) => unknown][] = [
    [/\/orientation/, () => orientation],
    [/\/head$/, () => ({ headSha: head.current })],
    [/\/changes$/, () => changes],
    [/\/reference-counts$/, (_body, url) => REFERENCE_COUNTS[url.searchParams.get("path")!] ?? []],
    [/\/outline$/, (_body, url) => OUTLINES[url.searchParams.get("path")!] ?? []],
    [
      /\/summary-draft/,
      () => ({ status: "ready", summary: "Looks good overall; one question on retries." }),
    ],
    [/\/explanation/, () => explanations.shift() ?? STEP_EXPLANATION],
    [
      /\/definitions/,
      () => [
        {
          name: "Options",
          kind: "type",
          path: "src/types.ts",
          line: 1,
          endLine: 1,
          lines: ["export type Options = { retries: number };"],
          source: "lsp",
          scope: "repo",
          signature: "type Options = { retries: number }",
          hover: null,
          tokens: [
            [
              { text: "export type ", light: "#d73a49", dark: "#f97583", keyword: true },
              { text: "Options = { retries: number };" },
            ],
          ],
        },
      ],
    ],
    [
      /\/references/,
      () => [
        {
          path: "src/client.ts",
          line: 10,
          text: "export function load(options: Options) {",
          tokens: [
            { text: "export function ", light: "#d73a49", dark: "#f97583", keyword: true },
            { text: "load(options: Options) {" },
          ],
        },
      ],
    ],
    [/\/assist$/, () => streamedText(ASSIST_REPLY)],
    [/\/session$/, (body) => applySessionAction(store, key, SessionActionSchema.parse(body))],
    [
      /\/submit$/,
      (body) => {
        const submitted = body as SubmitBody;
        store.recordSubmission(key, {
          reviewId: 42,
          url: SUBMITTED_REVIEW_URL,
          event: submitted.event,
          headSha: submitted.headSha,
          body: submitted.summary,
        });
        return store.getSession(key);
      },
    ],
    [/\/conversation$/, () => conversation],
    [/\/api\/pr\/acme\/app\/7$/, () => payload],
  ];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method: init?.method ?? "GET", body });
    const path = url.split("?")[0];
    const route = routes.find(([pattern]) => pattern.test(path));
    if (!route) return Response.json({ error: "not found" }, { status: 404 });
    const result = await route[1](body, new URL(url, "http://test"));
    return result instanceof Response ? result : Response.json(result);
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    store,
    head,
    actions: () => calls.filter((call) => call.url.endsWith("/session")).map((call) => call.body),
  };
}
