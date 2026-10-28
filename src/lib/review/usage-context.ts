import type { Reference, SymbolIndex } from "@/lib/symbols/symbol-index";
import type { SymbolDefinition, SymbolKind } from "@/lib/types";

export type UsageIndex = Pick<
  SymbolIndex,
  "definitionsIn" | "definitionsOf" | "referencesTo" | "readLines"
>;

type NumberedLine = { line: number; text: string };

export type UsageSite = Reference & { caller: string | null; code: NumberedLine[] };

export type DeclarationUsage = SymbolDefinition & {
  uses: UsageSite[];
  useCount: number;
  otherDefinitions: SymbolDefinition[];
};

const MAX_DECLARATIONS = 6;
const MAX_USES = 8;
const MAX_USES_WITH_CODE = 4;
const MAX_OTHER_DEFINITIONS = 3;
const CODE_LINES_BEFORE = 2;
const CODE_LINES_AFTER = 6;

const LOCAL_KINDS: ReadonlySet<SymbolKind> = new Set(["variable", "constant", "property"]);
const MEMBER_KINDS: ReadonlySet<SymbolKind> = new Set(["method", "property"]);
const IMPORT_LINE = /^\s*(import\b|export\s*(\*|\{))/;

function encloses(outer: SymbolDefinition, inner: SymbolDefinition): boolean {
  return outer !== inner && outer.line <= inner.line && inner.endLine <= outer.endLine;
}

function isLocal(definition: SymbolDefinition, all: SymbolDefinition[]): boolean {
  return (
    LOCAL_KINDS.has(definition.kind) &&
    all.some((other) => other.kind !== "parameter" && encloses(other, definition))
  );
}

function declarationsIn(index: UsageIndex, path: string): SymbolDefinition[] {
  const all = index.definitionsIn(path);
  return all.filter((definition) => definition.kind !== "parameter" && !isLocal(definition, all));
}

function spans(definition: SymbolDefinition, line: number): boolean {
  return definition.line <= line && line <= definition.endLine;
}

function innermostAt(declarations: SymbolDefinition[], line: number): SymbolDefinition | null {
  return declarations
    .filter((declaration) => spans(declaration, line))
    .reduce<SymbolDefinition | null>(
      (inner, declaration) =>
        inner === null || declaration.endLine - declaration.line < inner.endLine - inner.line
          ? declaration
          : inner,
      null,
    );
}

function declarationsOn(
  index: UsageIndex,
  path: string,
  lines: ReadonlySet<number>,
): SymbolDefinition[] {
  const declarations = declarationsIn(index, path);
  const enclosing = [...lines].map((line) => innermostAt(declarations, line));
  return declarations
    .filter((declaration) => lines.has(declaration.line) || enclosing.includes(declaration))
    .slice(0, MAX_DECLARATIONS);
}

function isInside(reference: Reference, definition: SymbolDefinition): boolean {
  return reference.path === definition.path && spans(definition, reference.line);
}

function isSameDefinition(a: SymbolDefinition, b: SymbolDefinition): boolean {
  return a.path === b.path && a.line === b.line;
}

function otherDefinitionsOf(index: UsageIndex, declaration: SymbolDefinition): SymbolDefinition[] {
  return index
    .definitionsOf(declaration.name, declaration.path)
    .filter((other) => !isSameDefinition(other, declaration) && !MEMBER_KINDS.has(other.kind))
    .slice(0, MAX_OTHER_DEFINITIONS);
}

function codeAround(index: UsageIndex, use: Reference): NumberedLine[] {
  const start = Math.max(1, use.line - CODE_LINES_BEFORE);
  return index
    .readLines(use.path, start, use.line + CODE_LINES_AFTER)
    .map((text, offset) => ({ line: start + offset, text }));
}

function siteOf(index: UsageIndex, use: Reference, withCode: boolean): UsageSite {
  const caller = innermostAt(declarationsIn(index, use.path), use.line);
  return {
    ...use,
    caller: caller?.name ?? null,
    code: withCode ? codeAround(index, use) : [],
  };
}

function sitesOf(index: UsageIndex, uses: Reference[]): UsageSite[] {
  let withCodeLeft = MAX_USES_WITH_CODE;
  return uses.slice(0, MAX_USES).map((use) => {
    const withCode = withCodeLeft > 0 && !IMPORT_LINE.test(use.text);
    if (withCode) withCodeLeft -= 1;
    return siteOf(index, use, withCode);
  });
}

async function usageOf(
  index: UsageIndex,
  declaration: SymbolDefinition,
): Promise<DeclarationUsage> {
  const references = await index.referencesTo(declaration.name);
  const uses = references.filter((reference) => !isInside(reference, declaration));
  return {
    ...declaration,
    uses: sitesOf(index, uses),
    useCount: uses.length,
    otherDefinitions: otherDefinitionsOf(index, declaration),
  };
}

export function usageContext(
  index: UsageIndex,
  path: string,
  lines: ReadonlySet<number>,
): Promise<DeclarationUsage[]> {
  return Promise.all(
    declarationsOn(index, path, lines).map((declaration) => usageOf(index, declaration)),
  );
}

function countSummary(usage: DeclarationUsage): string {
  if (usage.useCount === 0) return "no uses outside its own definition";
  return usage.useCount === 1 ? "1 use elsewhere" : `${usage.useCount} uses elsewhere`;
}

function siteText(site: UsageSite): string[] {
  if (site.code.length === 0) return [`  ${site.path}:${site.line}: ${site.text.trim()}`];
  const where = site.caller ? ` in ${site.caller}` : "";
  return [
    `  ${site.path}:${site.line}${where}:`,
    ...site.code.map((numbered) => `    ${numbered.line}: ${numbered.text}`),
  ];
}

function usageBlock(usage: DeclarationUsage): string {
  return [
    `${usage.name} (${usage.kind}) ${usage.path}:${usage.line}-${usage.endLine}, ${countSummary(usage)}`,
    ...usage.uses.flatMap(siteText),
    ...usage.otherDefinitions.map(
      (other) => `  Also defined at: ${other.path}:${other.line} (${other.kind})`,
    ),
  ].join("\n");
}

export function usageText(usages: DeclarationUsage[]): string {
  return usages.map(usageBlock).join("\n");
}
