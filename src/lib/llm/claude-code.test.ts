import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  claudeCodeArgs,
  claudeCodeEnvironment,
  claudeCodeFrame,
  claudeCodePrompt,
  sendPromptToClaude,
} from "./claude-code";

const REQUEST = {
  system: "be brief",
  maxTokens: 300,
  messages: [{ role: "user" as const, content: "hello" }],
};

function valueAfter(args: string[], flag: string): string | undefined {
  return args[args.indexOf(flag) + 1];
}

describe("claudeCodeArgs", () => {
  const args = claudeCodeArgs("haiku", REQUEST);

  it("asks for one streamed turn with the app's own system prompt and the chosen model", () => {
    expect(args).toContain("-p");
    expect(valueAfter(args, "--model")).toBe("haiku");
    expect(valueAfter(args, "--system-prompt")).toBe("be brief");
    expect(valueAfter(args, "--output-format")).toBe("stream-json");
    expect(valueAfter(args, "--max-turns")).toBe("1");
    expect(args).toContain("--include-partial-messages");
    expect(args).toContain("--verbose");
  });

  it("leaves out tools, MCP servers, skills, settings and saved sessions to save tokens", () => {
    expect(valueAfter(args, "--tools")).toBe("");
    expect(valueAfter(args, "--setting-sources")).toBe("");
    expect(args).toContain("--strict-mcp-config");
    expect(args).toContain("--disable-slash-commands");
    expect(args).toContain("--no-session-persistence");
  });
});

describe("claudeCodePrompt", () => {
  it("sends a single user message as it is", () => {
    expect(claudeCodePrompt([{ role: "user", content: "hello" }])).toBe("hello");
  });

  it("renders a conversation as labelled turns", () => {
    expect(
      claudeCodePrompt([
        { role: "user", content: "first" },
        { role: "assistant", content: "answer" },
        { role: "user", content: "again" },
      ]),
    ).toBe("User:\nfirst\n\nAssistant:\nanswer\n\nUser:\nagain");
  });

  it("keeps the text of block content", () => {
    expect(
      claudeCodePrompt([
        { role: "user", content: [{ type: "text", text: "a" }] },
        { role: "assistant", content: "b" },
      ]),
    ).toBe("User:\na\n\nAssistant:\nb");
  });
});

describe("claudeCodeEnvironment", () => {
  it("caps the output at the request's token limit", () => {
    expect(claudeCodeEnvironment({ thinking: true, maxOutputTokens: 2348 }, {})).toMatchObject({
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: "2348",
    });
  });

  it("turns thinking off when asked", () => {
    const withoutThinking = claudeCodeEnvironment({ thinking: false, maxOutputTokens: 300 }, {});
    expect(withoutThinking.MAX_THINKING_TOKENS).toBe("0");
    const withThinking = claudeCodeEnvironment({ thinking: true, maxOutputTokens: 300 }, {});
    expect(withThinking).not.toHaveProperty("MAX_THINKING_TOKENS");
  });

  it("passes credentials through only when they are set", () => {
    const options = { thinking: true, maxOutputTokens: 300 };
    expect(claudeCodeEnvironment(options, {})).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(
      claudeCodeEnvironment(options, {
        ANTHROPIC_API_KEY: "key",
        CLAUDE_CODE_OAUTH_TOKEN: "token",
        UNRELATED: "x",
      }),
    ).toMatchObject({ ANTHROPIC_API_KEY: "key", CLAUDE_CODE_OAUTH_TOKEN: "token" });
    expect(claudeCodeEnvironment(options, { UNRELATED: "x" })).not.toHaveProperty("UNRELATED");
  });
});

describe("claudeCodeFrame", () => {
  it("unwraps a stream event into the raw model event", () => {
    const event = { type: "content_block_delta", delta: { type: "text_delta", text: "hi" } };
    expect(claudeCodeFrame(JSON.stringify({ type: "stream_event", event }))).toEqual(event);
  });

  it("ignores everything else", () => {
    expect(claudeCodeFrame("")).toBeNull();
    expect(claudeCodeFrame("   ")).toBeNull();
    expect(claudeCodeFrame(JSON.stringify({ type: "system", subtype: "init" }))).toBeNull();
    expect(claudeCodeFrame(JSON.stringify({ type: "result", is_error: false }))).toBeNull();
  });

  it("throws the message of a failed run", () => {
    expect(() =>
      claudeCodeFrame(
        JSON.stringify({ type: "result", is_error: true, result: "Credit balance is too low" }),
      ),
    ).toThrow("Credit balance is too low");
  });

  it("throws the message of a stream error event", () => {
    const event = { type: "error", error: { message: "overloaded" } };
    expect(() => claudeCodeFrame(JSON.stringify({ type: "stream_event", event }))).toThrow(
      "overloaded",
    );
  });
});

describe("sendPromptToClaude", () => {
  it("does not crash the server when claude exits before reading the prompt", async () => {
    const closedStdin = new Writable({
      write(_chunk, _encoding, callback) {
        callback(Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
      },
    });
    sendPromptToClaude(closedStdin, "x".repeat(4_000_000));
    await new Promise((resolve) => setImmediate(resolve));
    expect(closedStdin.destroyed).toBe(true);
  });
});
