import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { autoModel, claudeOllamaSizesPath, llmConfig, ollamaModels } from "./model-choice";

const SIZES = {
  "27b": { model: "qwen3.8-27b-cc" },
  "35b": { model: "qwen3.6-35b-cc" },
  "35b-coding": { model: "qwen3.6-35b-coding-cc" },
};

function claudeCustomCheckout(): { binDir: string; sizesPath: string } {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "claude-custom-")));
  mkdirSync(path.join(root, "repo", "bin"), { recursive: true });
  mkdirSync(path.join(root, "repo", "ollama"));
  mkdirSync(path.join(root, "path-bin"));
  const launcher = path.join(root, "repo", "bin", "claude-ollama");
  writeFileSync(launcher, "");
  symlinkSync(launcher, path.join(root, "path-bin", "claude-ollama"));
  const sizesPath = path.join(root, "repo", "ollama", "sizes.json");
  writeFileSync(sizesPath, JSON.stringify(SIZES));
  return { binDir: path.join(root, "path-bin"), sizesPath };
}

function ollamaWith(names: string[]): typeof fetch {
  return (async () => Response.json({ models: names.map((name) => ({ name })) })) as typeof fetch;
}

const unreachable = (async () => {
  throw new Error("connection refused");
}) as typeof fetch;

describe("claudeOllamaSizesPath", () => {
  it("follows the claude-ollama launcher on PATH to its sizes.json", async () => {
    const { binDir, sizesPath } = claudeCustomCheckout();
    expect(await claudeOllamaSizesPath({ PATH: `/nowhere:${binDir}` })).toBe(sizesPath);
  });

  it("is null when claude-ollama is not on PATH", async () => {
    expect(await claudeOllamaSizesPath({ PATH: "/nowhere" })).toBeNull();
  });
});

describe("llmConfig", () => {
  it("picks the first claude-ollama model that Ollama has installed", async () => {
    const { binDir } = claudeCustomCheckout();
    const fetchImpl = ollamaWith([
      "llama3:latest",
      "qwen3.6-35b-coding-cc:latest",
      "qwen3.6-35b-cc",
    ]);
    expect((await llmConfig({ PATH: binDir }, fetchImpl)).model).toBe("qwen3.6-35b-cc");
  });

  it("keeps an explicitly configured model", async () => {
    const { binDir } = claudeCustomCheckout();
    const env = { PATH: binDir, REVIEW_QUEUE_LLM_MODEL: "mine" };
    expect((await llmConfig(env, ollamaWith(["qwen3.6-35b-cc"]))).model).toBe("mine");
  });

  it("falls back to the default when no claude-ollama model is installed", async () => {
    const { binDir } = claudeCustomCheckout();
    const fallback = (await llmConfig({ PATH: "/nowhere" }, unreachable)).model;
    expect((await llmConfig({ PATH: binDir }, ollamaWith(["llama3:latest"]))).model).toBe(fallback);
    expect((await llmConfig({ PATH: binDir }, unreachable)).model).toBe(fallback);
  });

  it("prefers saved settings to the environment", async () => {
    const { binDir } = claudeCustomCheckout();
    const env = { PATH: binDir, REVIEW_QUEUE_LLM_MODEL: "from-env" };
    const saved = { enabled: true, model: "saved", thinking: false, timeoutMs: 1234 };
    expect(await llmConfig(env, ollamaWith(["qwen3.6-35b-cc"]), saved)).toMatchObject({
      model: "saved",
      thinking: false,
      timeoutMs: 1234,
    });
  });

  it("picks a model automatically when the saved model is auto", async () => {
    const { binDir } = claudeCustomCheckout();
    const env = { PATH: binDir, REVIEW_QUEUE_LLM_MODEL: "from-env" };
    const saved = { enabled: true, model: null, thinking: true, timeoutMs: 1234 };
    const config = await llmConfig(env, ollamaWith(["qwen3.6-35b-cc"]), saved);
    expect(config.model).toBe("qwen3.6-35b-cc");
  });
});

describe("autoModel", () => {
  it("is the first claude-ollama model among the installed ones", async () => {
    const { binDir } = claudeCustomCheckout();
    const env = { PATH: binDir };
    expect(await autoModel(env, ["qwen3.6-35b-coding-cc", "qwen3.6-35b-cc"])).toBe(
      "qwen3.6-35b-cc",
    );
    expect(await autoModel(env, ["llama3"])).toBeNull();
  });
});

describe("ollamaModels", () => {
  it("lists installed models without the :latest tag", async () => {
    expect(await ollamaModels("http://llm.test", ollamaWith(["a:latest", "b:4b"]))).toEqual([
      "a",
      "b:4b",
    ]);
  });
});
