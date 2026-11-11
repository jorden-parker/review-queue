import { mkdirSync } from "node:fs";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Writable } from "node:stream";
import { spawnProcess } from "@/lib/exec";
import type { Message, ModelRequest, StreamEvent } from "./client";

export type ClaudeProcess = Pick<
  ChildProcessWithoutNullStreams,
  "stdin" | "stdout" | "stderr" | "kill" | "once"
>;

export type ClaudeLauncher = (
  model: string,
  request: ModelRequest,
  thinking: boolean,
) => ClaudeProcess;

type EnvironmentOptions = { thinking: boolean; maxOutputTokens: number };

type Env = Record<string, string | undefined>;

const PASSED_THROUGH_CREDENTIALS = ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"];

const EMPTY_WORKING_DIRECTORY = path.join(tmpdir(), "review-queue-claude-code");

export function claudeCodeArgs(model: string, request: ModelRequest): string[] {
  return [
    "-p",
    "--model",
    model,
    "--system-prompt",
    request.system,
    "--tools",
    "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--setting-sources",
    "",
    "--no-session-persistence",
    "--max-turns",
    "1",
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
  ];
}

function messageText(message: Message): string {
  if (typeof message.content === "string") return message.content;
  return message.content
    .map((block) => {
      if (block.type === "text") return block.text;
      return block.type === "tool_result" ? block.content : "";
    })
    .filter((text) => text !== "")
    .join("\n");
}

const TURN_LABELS = { user: "User", assistant: "Assistant" };

export function claudeCodePrompt(messages: Message[]): string {
  const [only] = messages;
  if (messages.length === 1 && only?.role === "user") return messageText(only);
  return messages
    .map((message) => `${TURN_LABELS[message.role]}:\n${messageText(message)}`)
    .join("\n\n");
}

export function claudeCodeEnvironment(
  options: EnvironmentOptions,
  source: Env = process.env,
): Record<string, string> {
  const credentials = PASSED_THROUGH_CREDENTIALS.flatMap((name) => {
    const value = source[name];
    return value ? [[name, value]] : [];
  });
  return {
    ...Object.fromEntries(credentials),
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(options.maxOutputTokens),
    ...(options.thinking ? {} : { MAX_THINKING_TOKENS: "0" }),
  };
}

type Frame = {
  type?: string;
  event?: StreamEvent;
  is_error?: boolean;
  result?: string;
};

export function claudeCodeFrame(line: string): StreamEvent | null {
  if (!line.trim()) return null;
  const frame = JSON.parse(line) as Frame;
  if (frame.type === "result" && frame.is_error) {
    throw new Error(frame.result ?? "Claude Code failed");
  }
  if (frame.type !== "stream_event" || !frame.event) return null;
  if (frame.event.type === "error") {
    throw new Error(frame.event.error?.message ?? "Claude Code stream failed");
  }
  return frame.event;
}

export function sendPromptToClaude(stdin: Writable, prompt: string): void {
  stdin.on("error", () => undefined);
  stdin.end(prompt);
}

export const launchClaudeCode: ClaudeLauncher = (model, request, thinking) => {
  mkdirSync(EMPTY_WORKING_DIRECTORY, { recursive: true });
  const child = spawnProcess(
    process.env.REVIEW_QUEUE_CLAUDE_BIN ?? "claude",
    claudeCodeArgs(model, request),
    {
      cwd: EMPTY_WORKING_DIRECTORY,
      env: claudeCodeEnvironment({ thinking, maxOutputTokens: request.maxTokens }),
    },
  );
  sendPromptToClaude(child.stdin, claudeCodePrompt(request.messages));
  return child;
};
