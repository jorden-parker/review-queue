import path from "node:path";
import { createHighlighter, type BundledLanguage, type Highlighter, type ThemedToken } from "shiki";
import type { FileDiff } from "@/lib/types";

export type Token = {
  text: string;
  light?: string;
  dark?: string;
  literal?: boolean;
  keyword?: boolean;
};

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

const CODE_INSIDE_LITERAL = /^(meta\.template\.expression|meta\.embedded)/;
const LITERAL = /^(string|comment)/;
const IDENTIFIER_CHAR = /[A-Za-z_$]/;

function isLiteralScope(scopes: { scopeName: string }[]): boolean {
  for (const { scopeName } of [...scopes].reverse()) {
    if (CODE_INSIDE_LITERAL.test(scopeName)) return false;
    if (LITERAL.test(scopeName)) return true;
  }
  return false;
}

const KEYWORD =
  /^(keyword|storage|constant\.numeric|constant\.language|support\.type\.primitive|variable\.language)/;

type Explanation = NonNullable<ThemedToken["explanation"]>[number];
type WordClass = "literal" | "keyword" | "code";

function classify(part: Explanation): WordClass {
  if (isLiteralScope(part.scopes)) return "literal";
  const innermost = part.scopes.at(-1)?.scopeName ?? "";
  return KEYWORD.test(innermost) ? "keyword" : "code";
}

type Run = { text: string; wordClass: WordClass | null };

function runsOf(token: ThemedToken): Run[] {
  const runs: Run[] = [];
  for (const part of token.explanation ?? [{ content: token.content, scopes: [] }]) {
    const wordClass = IDENTIFIER_CHAR.test(part.content) ? classify(part) : null;
    const last = runs.at(-1);
    if (last && (wordClass === null || last.wordClass === null || last.wordClass === wordClass)) {
      last.text += part.content;
      last.wordClass ??= wordClass;
    } else {
      runs.push({ text: part.content, wordClass });
    }
  }
  return runs;
}

function toTokens(token: ThemedToken): Token[] {
  const colours = { light: token.htmlStyle?.color, dark: token.htmlStyle?.["--shiki-dark"] };
  return runsOf(token).map(({ text, wordClass }) => {
    if (wordClass === "literal") return { text, ...colours, literal: true };
    if (wordClass === "keyword") return { text, ...colours, keyword: true };
    return { text, ...colours };
  });
}

const MAX_HIGHLIGHTED_LINE_LENGTH = 2_000;

export async function highlightLines(file: string, lines: string[]): Promise<Token[][]> {
  const lang = languageOf(file);
  if (!lang) return plainLines(lines);
  const shiki = await loadHighlighter();
  const { tokens } = shiki.codeToTokens(lines.join("\n"), {
    lang,
    themes: THEMES,
    includeExplanation: "scopeName",
    tokenizeTimeLimit: 0,
    tokenizeMaxLineLength: MAX_HIGHLIGHTED_LINE_LENGTH,
  });
  return tokens.map((row) => row.flatMap(toTokens));
}

export async function highlightFile(file: FileDiff): Promise<HighlightedHunk[]> {
  const texts = file.hunks.map((hunk) => hunk.lines.map((line) => line.text));
  if (file.binary) return texts.map(plainLines);
  return Promise.all(texts.map((lines) => highlightLines(file.path, lines)));
}
