import { vi } from "vitest";
import { applySessionAction, SessionActionSchema } from "@/lib/review/session-actions";
import { SessionStore } from "@/lib/session/store";
import type { ReviewPayload } from "@/lib/review/prepare";

type Call = { url: string; method: string; body: unknown };

export function installFakeApi(
  payload: ReviewPayload,
  orientation: unknown = { status: "disabled" },
) {
  const store = new SessionStore(":memory:");
  const calls: Call[] = [];
  const key = "acme/app#7";
  const routes: [RegExp, (body: unknown) => unknown][] = [
    [/\/orientation/, () => orientation],
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
          tokens: [
            [
              { text: "export type ", light: "#d73a49", dark: "#f97583" },
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
            { text: "export function ", light: "#d73a49", dark: "#f97583" },
            { text: "load(options: Options) {" },
          ],
        },
      ],
    ],
    [/\/session$/, (body) => applySessionAction(store, key, SessionActionSchema.parse(body))],
    [/\/submit$/, () => store.getSession(key)],
    [/\/api\/pr\/acme\/app\/7$/, () => payload],
  ];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method: init?.method ?? "GET", body });
    const path = url.split("?")[0];
    const route = routes.find(([pattern]) => pattern.test(path));
    if (!route) return Response.json({ error: "not found" }, { status: 404 });
    const result = route[1](body);
    return result instanceof Response ? result : Response.json(result);
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    store,
    actions: () => calls.filter((call) => call.url.endsWith("/session")).map((call) => call.body),
  };
}
