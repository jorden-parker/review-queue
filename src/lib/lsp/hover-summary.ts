import type { SymbolKind } from "@/lib/types";

export type HoverSummary = { kind: SymbolKind; signature: string };

const CODE_BLOCK = /```[\w-]*\n([\s\S]*?)\n```/g;
const DOCS_SEPARATOR = /\n---\n/;

const KIND_PATTERNS: [RegExp, SymbolKind][] = [
  [/^\(parameter\)|^param\b/, "parameter"],
  [/^\((property|field)\)|^field\b/, "property"],
  [/^\(method\)|^method\b/, "method"],
  [/^(\(alias\) )?(\(\w+\) )?(export )?(declare )?(async )?(function|def|func)\b/, "function"],
  [/^(pub(\(\w+\))? )?(const |async |unsafe )*fn\b/, "function"],
  [/^import\b|^\(module\)|^module\b|^package\b|^(pub )?mod\b/, "module"],
  [/^(\(class\) )?(abstract )?class\b|^(pub )?struct\b/, "class"],
  [/^interface\b|^(pub )?trait\b/, "interface"],
  [/^(const )?enum\b|^(pub )?enum\b/, "enum"],
  [/^(\(type\) )?type\b|^(pub )?type\b/, "type"],
  [/^const\b|^\(constant\)|^(pub )?(const|static)\b/, "constant"],
];

function declaration(hover: string): string {
  const head = hover.split(DOCS_SEPARATOR)[0];
  const blocks = [...head.matchAll(CODE_BLOCK)].map((match) => match[1]);
  const code = blocks.at(-1) ?? head;
  return code.trim().split("\n")[0].trim();
}

function kindOf(signature: string): SymbolKind {
  return KIND_PATTERNS.find(([pattern]) => pattern.test(signature))?.[1] ?? "variable";
}

export function hoverSummary(hover: string): HoverSummary {
  const signature = declaration(hover);
  return { kind: kindOf(signature), signature };
}
