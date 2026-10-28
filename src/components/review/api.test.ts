import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSIST_ERROR_MARKER } from "@/lib/assist-protocol";
import type { AssistRequest } from "@/lib/review/assist-request";
import { streamAssist } from "./api";

const REF = { owner: "acme", repo: "app", number: 7 };
const SHA = "a".repeat(40);
const REQUEST: AssistRequest = {
  action: "explain",
  target: { kind: "file", path: "src/a.ts" },
  question: null,
  history: [],
};

function stubResponse(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
}

function ask(onUpdate = vi.fn()) {
  return streamAssist(REF, SHA, REQUEST, onUpdate, new AbortController().signal);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamAssist", () => {
  it("names the HTTP status when an error body is not JSON", async () => {
    stubResponse(new Response("Internal Server Error", { status: 500 }));
    await expect(ask()).rejects.toThrow("HTTP 500");
  });

  it("shows the server message when an error body is JSON", async () => {
    stubResponse(Response.json({ error: "Local model is off" }, { status: 404 }));
    await expect(ask()).rejects.toThrow("Local model is off");
  });

  it("fails instead of resolving when the response has no body", async () => {
    stubResponse(new Response(null, { status: 200 }));
    await expect(ask()).rejects.toThrow("no answer");
  });

  it("throws the failure the stream ends with, after the text before it", async () => {
    stubResponse(new Response(`Partial${ASSIST_ERROR_MARKER}boom`));
    const onUpdate = vi.fn();
    await expect(ask(onUpdate)).rejects.toThrow("boom");
    expect(onUpdate).toHaveBeenLastCalledWith({ text: "Partial", lookups: [], failure: "boom" });
  });

  it("decodes a character split across two chunks", async () => {
    const bytes = new TextEncoder().encode("Hi 🙂 done");
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 5));
        controller.enqueue(bytes.slice(5));
        controller.close();
      },
    });
    stubResponse(new Response(body));
    const onUpdate = vi.fn();
    await ask(onUpdate);
    expect(onUpdate).toHaveBeenLastCalledWith({ text: "Hi 🙂 done", lookups: [], failure: null });
  });
});
