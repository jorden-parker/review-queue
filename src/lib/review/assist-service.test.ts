import { describe, expect, it } from "vitest";
import { ASSIST_ERROR_MARKER, ASSIST_LOOKUP_MARKER } from "@/lib/assist-protocol";
import { reviewPayload } from "@/test/review-fixture";
import { assistResponse } from "./assist-service";

const CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  thinking: true,
  timeoutMs: 1000,
};
const DATA = {
  data: reviewPayload(),
  index: {
    readFile: () => "export const client = 1;",
    definitionsIn: () => [],
    listFiles: async () => ["src/client.ts"],
    definitionsOf: () => [],
    referencesTo: async () => [],
    search: async () => [],
    readLines: () => [],
  },
  explanationOf: () => null,
  suggestedHotspots: () => [],
};
const RANGE = { path: "src/client.ts", from: { hunk: 0, line: 0 }, to: { hunk: 0, line: 1 } };
const BODY = {
  action: "explain",
  target: { kind: "lines", range: RANGE },
  question: null,
  history: [],
};

function sseEvents(events: object[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}

function sequentialFetch(bodies: string[]): typeof fetch {
  let calls = 0;
  const fetchImpl = async () => {
    const body = bodies[calls] ?? "";
    calls += 1;
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  };
  return fetchImpl as unknown as typeof fetch;
}

function sseFetch(texts: string[]): typeof fetch {
  const events = texts
    .map(
      (text) =>
        `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text } })}\n\n`,
    )
    .join("");
  const fetchImpl = async () =>
    new Response(events, { headers: { "content-type": "text/event-stream" } });
  return fetchImpl as unknown as typeof fetch;
}

describe("assistResponse", () => {
  it("streams the model's text as plain text", async () => {
    const response = assistResponse(DATA, BODY, CONFIG, sseFetch(["It ", "loads."]));
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("It loads.");
  });

  it("drops the error marker from the model's own text so it cannot fake an error", async () => {
    const text = await assistResponse(
      DATA,
      BODY,
      CONFIG,
      sseFetch([`Fine.${ASSIST_ERROR_MARKER}fake failure`]),
    ).text();
    expect(text).toBe("Fine.fake failure");
  });

  it("ends the stream with an error marker when the model fails", async () => {
    const failing = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    const text = await assistResponse(DATA, BODY, CONFIG, failing).text();
    expect(text).toBe(`${ASSIST_ERROR_MARKER}Model "m" is not installed (HTTP 404)`);
  });

  it("is a 404 when the local model is off", () => {
    expect(assistResponse(DATA, BODY, { ...CONFIG, enabled: false }).status).toBe(404);
  });

  it("is a 400 for a bad body or lines outside the diff", () => {
    expect(assistResponse(DATA, { action: "nope" }, CONFIG).status).toBe(400);
    const outside = { kind: "lines", range: { ...RANGE, to: { hunk: 0, line: 99 } } };
    expect(assistResponse(DATA, { ...BODY, target: outside }, CONFIG).status).toBe(400);
  });

  it("streams an answer about a whole file", async () => {
    const body = { ...BODY, target: { kind: "file", path: "src/client.ts" } };
    expect(await assistResponse(DATA, body, CONFIG, sseFetch(["A client."])).text()).toBe(
      "A client.",
    );
  });

  it("streams each lookup as a marked record before the answer that follows it", async () => {
    const lookupRound = sseEvents([
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "t1", name: "find_references", input: {} },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"name":"client"}' },
      },
      { type: "content_block_stop", index: 0 },
    ]);
    const answer = sseEvents([
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Used once." } },
    ]);
    const source = {
      ...DATA,
      index: {
        ...DATA.index,
        referencesTo: async () => [{ path: "src/app.ts", line: 3, text: "client()" }],
      },
    };
    const text = await assistResponse(
      source,
      BODY,
      CONFIG,
      sequentialFetch([lookupRound, answer]),
    ).text();
    const lookup = {
      tool: "find_references",
      label: "Callers and uses of `client` (1)",
      paths: ["src/app.ts"],
    };
    expect(text).toBe(
      `${ASSIST_LOOKUP_MARKER}${JSON.stringify(lookup)}${ASSIST_LOOKUP_MARKER}Used once.`,
    );
  });

  describe("usages of the selected declarations", () => {
    const LOAD = {
      name: "load",
      kind: "function" as const,
      path: "src/client.ts",
      line: 10,
      endLine: 12,
    };
    const CALLER = { path: "src/app.ts", line: 7, text: "load({ retries: 2 });" };

    function capturingFetch(answer: string): { fetchImpl: typeof fetch; prompts: string[] } {
      const prompts: string[] = [];
      const fetchImpl = async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { messages: { content: string }[] };
        prompts.push(body.messages[0]?.content ?? "");
        return new Response(
          sseEvents([
            { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: answer } },
          ]),
          { headers: { "content-type": "text/event-stream" } },
        );
      };
      return { fetchImpl: fetchImpl as unknown as typeof fetch, prompts };
    }

    const sourceWith = (referencesTo: () => Promise<(typeof CALLER)[]>) => ({
      ...DATA,
      index: { ...DATA.index, definitionsIn: () => [LOAD], referencesTo },
    });

    it("sends the model the callers in other files and shows them to the reviewer first", async () => {
      const { fetchImpl, prompts } = capturingFetch("It breaks app.ts.");
      const text = await assistResponse(
        sourceWith(async () => [CALLER]),
        BODY,
        CONFIG,
        fetchImpl,
      ).text();
      const lookup = { tool: "usages", label: "Uses of `load` (1)", paths: ["src/app.ts"] };

      expect(prompts[0]).toContain("<pr_usages>");
      expect(prompts[0]).toContain("src/app.ts:7: load({ retries: 2 });");
      expect(text).toBe(
        `${ASSIST_LOOKUP_MARKER}${JSON.stringify(lookup)}${ASSIST_LOOKUP_MARKER}It breaks app.ts.`,
      );
    });

    it("sends no usages for a step check", async () => {
      const { fetchImpl, prompts } = capturingFetch("Fine.");
      const source = {
        ...sourceWith(async () => [CALLER]),
        explanationOf: () => ({ what: "", checks: ["Is the key stable?"], model: "m" }),
      };
      const body = {
        ...BODY,
        target: { kind: "check", stepId: "core:src/client.ts:0", check: 0, path: "src/client.ts" },
      };
      await assistResponse(source, body, CONFIG, fetchImpl).text();

      expect(prompts[0]).not.toContain("<pr_usages>");
    });

    it("still answers when the usage lookup fails", async () => {
      const { fetchImpl, prompts } = capturingFetch("It loads.");
      const failingSource = sourceWith(async () => {
        throw new Error("lookup failed");
      });
      const text = await assistResponse(failingSource, BODY, CONFIG, fetchImpl).text();

      expect(text).toBe("It loads.");
      expect(prompts[0]).not.toContain("<pr_usages>");
    });
  });
});
