import { describe, expect, it } from "vitest";
import { SessionStore } from "@/lib/session/store";
import { savedLlmSettings } from "./llm-settings";
import { clearCacheResponse, settingsView, updateSettings } from "./settings-service";

const ENV = { PATH: "/nowhere", REVIEW_QUEUE_LLM_TIMEOUT_MS: "8000" };
const SETTINGS = { enabled: true, model: "b", thinking: false, timeoutMs: 20_000 };

function ollamaWith(names: string[]): typeof fetch {
  return (async () => Response.json({ models: names.map((name) => ({ name })) })) as typeof fetch;
}

const unreachable = (async () => {
  throw new Error("connection refused");
}) as typeof fetch;

describe("settingsView", () => {
  it("shows the environment's settings and the installed models until settings are saved", async () => {
    const store = new SessionStore(":memory:");
    expect(await settingsView(store, ENV, ollamaWith(["a:latest", "b"]))).toEqual({
      llm: { enabled: true, model: null, thinking: true, timeoutMs: 8000 },
      models: ["a", "b"],
      autoModel: null,
    });
  });

  it("still loads when Ollama is unreachable", async () => {
    const store = new SessionStore(":memory:");
    const view = await settingsView(store, ENV, unreachable);
    expect(view).toMatchObject({ models: [], autoModel: null });
  });
});

describe("updateSettings", () => {
  it("saves valid settings and answers with the new view", async () => {
    const store = new SessionStore(":memory:");
    const response = await updateSettings(store, { llm: SETTINGS }, ENV, ollamaWith(["b"]));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ llm: SETTINGS, models: ["b"] });
    expect(savedLlmSettings(store)).toEqual(SETTINGS);
  });

  it("rejects settings that do not fit the schema", async () => {
    const store = new SessionStore(":memory:");
    const body = { llm: { ...SETTINGS, timeoutMs: 5 } };
    const response = await updateSettings(store, body, ENV, ollamaWith([]));
    expect(response.status).toBe(400);
    expect(savedLlmSettings(store)).toBeNull();
  });
});

describe("clearCacheResponse", () => {
  it("empties the cache, keeps settings, and says how many entries it removed", async () => {
    const store = new SessionStore(":memory:");
    store.setCached("orientation:v4:acme/app#7:abc:m", "{}");
    store.setCached("etag:repos/acme/app/pulls/7", "{}");
    store.setSetting("llm", JSON.stringify(SETTINGS));
    const response = clearCacheResponse(store);
    expect(await response.json()).toEqual({ cleared: 2 });
    expect(store.getCached("orientation:v4:acme/app#7:abc:m")).toBeNull();
    expect(savedLlmSettings(store)).toEqual(SETTINGS);
  });
});
