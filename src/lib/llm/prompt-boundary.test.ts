import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type ImportStatement = { clause: string; path: string };

const LLM_DIRECTORY = new URL(".", import.meta.url);
const ASSIST_SERVICE = new URL("../review/assist-service.ts", import.meta.url);
const REVIEW_DATA_SOURCE = new URL("../review/prepare.ts", import.meta.url);
const PULL_REQUEST_SOURCE = new URL("../github/gh.ts", import.meta.url);

const STATIC_IMPORT = /\bimport\s+(?:([^'"`;]*?)\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
const FORBIDDEN_FIELD = /comment|conversation|review/i;

function importsIn(text: string): ImportStatement[] {
  const statically = [...text.matchAll(STATIC_IMPORT)].map((match) => ({
    clause: match[1] ?? "",
    path: match[2],
  }));
  const dynamically = [...text.matchAll(DYNAMIC_IMPORT)].map((match) => ({
    clause: "",
    path: match[1],
  }));
  return [...statically, ...dynamically];
}

function isForbidden({ clause, path }: ImportStatement): boolean {
  if (/github\/conversation$/.test(path)) return true;
  return /github\/gh$/.test(path) && !clause.startsWith("type ");
}

function fieldNamesIn(text: string, typeName: string): string[] {
  const body =
    text.match(new RegExp(`export type ${typeName} = \\{([\\s\\S]*?)\\n\\};`))?.[1] ?? "";
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1]);
}

function nameOf(url: URL): string {
  return url.pathname.split("/").pop() ?? "";
}

function promptSources(): URL[] {
  const modules = readdirSync(LLM_DIRECTORY)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => new URL(name, LLM_DIRECTORY));
  return [...modules, ASSIST_SERVICE];
}

describe("prompt boundary helpers", () => {
  it("flags gh values, any conversation import and comment-like fields in fixtures", () => {
    expect(importsIn('import { x } from "@/lib/github/gh";').filter(isForbidden)).toHaveLength(1);
    expect(
      importsIn('import type { ReviewEvent } from "@/lib/github/gh";').filter(isForbidden),
    ).toHaveLength(0);
    expect(importsIn('import "../github/conversation";').filter(isForbidden)).toHaveLength(1);
    expect(
      fieldNamesIn(
        "export type ReviewData = {\n  headSha: string;\n  comments: number;\n};",
        "ReviewData",
      ),
    ).toEqual(["headSha", "comments"]);
  });
});

describe("prompt boundary", () => {
  it("scans every prompt module and the assist service", () => {
    expect(promptSources().map(nameOf)).toEqual(
      expect.arrayContaining(["client.ts", "orientation.ts", "assist.ts", "assist-service.ts"]),
    );
  });

  it("keeps GitHub conversation and gh values out of prompt code", () => {
    const violations = promptSources().flatMap((url) =>
      importsIn(readFileSync(url, "utf8"))
        .filter(isForbidden)
        .map((statement) => `${nameOf(url)}: ${statement.path}`),
    );
    expect(violations).toEqual([]);
  });

  it("keeps comment, conversation and review fields out of ReviewData and the PullRequest it embeds", () => {
    const fields = [
      ...fieldNamesIn(readFileSync(REVIEW_DATA_SOURCE, "utf8"), "ReviewData"),
      ...fieldNamesIn(readFileSync(PULL_REQUEST_SOURCE, "utf8"), "PullRequest"),
    ];
    expect(fields).toContain("headSha");
    expect(fields.filter((name) => FORBIDDEN_FIELD.test(name))).toEqual([]);
  });

  it("keeps one title limit and one data rule across the prompt modules", () => {
    const sources = promptSources().map((url) => ({
      name: nameOf(url),
      text: readFileSync(url, "utf8"),
    }));
    expect(
      sources.filter(({ text }) => text.includes("const TITLE_LIMIT")).map(({ name }) => name),
    ).toEqual(["client.ts"]);
    expect(
      sources
        .filter(({ text }) => text.includes("is written by the PR author"))
        .map(({ name }) => name),
    ).toEqual([]);
  });
});
