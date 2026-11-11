export const LLM_BACKENDS = ["local", "claude-code"] as const;

export type LlmBackend = (typeof LLM_BACKENDS)[number];

export const CLAUDE_MODELS = ["haiku", "sonnet", "opus"] as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[number];
