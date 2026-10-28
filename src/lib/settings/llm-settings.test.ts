import { describe, expect, it } from "vitest";
import { SessionStore } from "@/lib/session/store";
import {
  LlmSettingsSchema,
  llmSettingsFromEnv,
  saveLlmSettings,
  savedLlmSettings,
} from "./llm-settings";

const SETTINGS = { enabled: true, model: "qwen3:4b", thinking: false, timeoutMs: 20_000 };

describe("llmSettingsFromEnv", () => {
  it("reads the environment, with no model meaning auto", () => {
    expect(llmSettingsFromEnv({})).toEqual({
      enabled: true,
      model: null,
      thinking: true,
      timeoutMs: expect.any(Number),
    });
    expect(
      llmSettingsFromEnv({
        REVIEW_QUEUE_LLM: "off",
        REVIEW_QUEUE_LLM_MODEL: "mine",
        REVIEW_QUEUE_LLM_THINKING: "off",
        REVIEW_QUEUE_LLM_TIMEOUT_MS: "5000",
      }),
    ).toEqual({ enabled: false, model: "mine", thinking: false, timeoutMs: 5000 });
  });
});

describe("LlmSettingsSchema", () => {
  it("accepts a timeout of up to an hour, for slow machines and big files", () => {
    expect(LlmSettingsSchema.safeParse({ ...SETTINGS, timeoutMs: 3_600_000 }).success).toBe(true);
    expect(LlmSettingsSchema.safeParse({ ...SETTINGS, timeoutMs: 3_600_001 }).success).toBe(false);
  });
});

describe("savedLlmSettings", () => {
  it("is null until settings are saved, then returns them", () => {
    const store = new SessionStore(":memory:");
    expect(savedLlmSettings(store)).toBeNull();
    saveLlmSettings(store, SETTINGS);
    expect(savedLlmSettings(store)).toEqual(SETTINGS);
  });

  it("ignores a stored value that no longer fits the schema", () => {
    const store = new SessionStore(":memory:");
    store.setSetting("llm", "not json");
    expect(savedLlmSettings(store)).toBeNull();
    store.setSetting("llm", JSON.stringify({ enabled: "yes" }));
    expect(savedLlmSettings(store)).toBeNull();
  });
});
