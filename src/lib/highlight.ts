import path from "node:path";
import { createHighlighter, type BundledLanguage, type Highlighter } from "shiki";
import type { FileDiff } from "@/lib/types";

export type Token = { text: string; light?: string; dark?: string };

export type HighlightedHunk = Token[][];

const LANGUAGES: Record<string, BundledLanguage> = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "jsx",
  ".go": "go",
  ".py": "python",
  ".rs": "rust",
  ".swift": "swift",
  ".json": "json",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".md": "markdown",
  ".css": "css",
  ".html": "html",
  ".sh": "bash",
  ".sql": "sql",
  ".toml": "toml",
};
const THEMES = { light: "github-light", dark: "github-dark" } as const;

let highlighter: Promise<Highlighter> | null = null;

function loadHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({
    themes: Object.values(THEMES),
    langs: [...new Set(Object.values(LANGUAGES))],
  });
  return highlighter;
}

function languageOf(file: string): BundledLanguage | null {
  return LANGUAGES[path.extname(file)] ?? null;
}

function plainLines(texts: string[]): HighlightedHunk {
  return texts.map((text) => [{ text }]);
}

export async function highlightFile(file: FileDiff): Promise<HighlightedHunk[]> {
  const lang = languageOf(file.path);
  const texts = file.hunks.map((hunk) => hunk.lines.map((line) => line.text));
  if (!lang || file.binary) return texts.map(plainLines);
  const shiki = await loadHighlighter();
  return texts.map((lines) =>
    shiki.codeToTokens(lines.join("\n"), { lang, themes: THEMES }).tokens.map((row) =>
      row.map((token) => ({
        text: token.content,
        light: token.htmlStyle?.color,
        dark: token.htmlStyle?.["--shiki-dark"],
      })),
    ),
  );
}
