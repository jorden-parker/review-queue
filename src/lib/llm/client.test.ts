import { describe, expect, it } from "vitest";
import { askModel, llmConfigFromEnv } from "./client";

const CONFIG = { baseURL: "http://llm.test", model: "m", enabled: true, timeoutMs: 1000 };

function recordingFetch() {
  const bodies: unknown[] = [];
  const fetchImpl = async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ content: [{ type: "text", text: "ok" }] });
  };
  return { fetchImpl: fetchImpl as typeof fetch, bodies };
}

describe("llmConfigFromEnv", () => {
  it("defaults to local Ollama and can be switched off", () => {
    expect(llmConfigFromEnv({})).toMatchObject({
      baseURL: "http://localhost:11434",
      model: "qwen3.8-27b-cc",
      enabled: true,
    });
    expect(llmConfigFromEnv({ REVIEW_QUEUE_LLM: "off" }).enabled).toBe(false);
  });
});

describe("askModel", () => {
  it("sends the request's system prompt, token cap and messages", async () => {
    const { fetchImpl, bodies } = recordingFetch();
    const reply = await askModel(
      { config: CONFIG, fetchImpl },
      { system: "sys", maxTokens: 42, messages: [{ role: "user", content: "hi" }] },
    );
    expect(reply).toBe("ok");
    expect(bodies[0]).toMatchObject({
      model: "m",
      system: "sys",
      max_tokens: 42,
      messages: [{ role: "user", content: "hi" }],
      temperature: 0,
      stream: false,
    });
  });
});
