import { languageFor } from "@/lib/symbols/languages";
import type { Reference, SymbolIndex } from "@/lib/symbols/symbol-index";
import type { SymbolDefinition, SymbolKind } from "@/lib/types";
import {
  type CallPath,
  callPathsTo,
  IMPORT_LINE,
  isProductionCode,
  type ReferencesOf,
} from "./call-paths";
import { declarationsIn, innermostAt, isSameDefinition, spans } from "./declarations";
import { type Dependency, dependenciesOf, type NumberedLine, numberedLines } from "./dependencies";

export type UsageIndex = Pick<
  SymbolIndex,
  "definitionsIn" | "definitionsOf" | "referencesTo" | "readLines"
>;

export type UsageSite = Reference & { caller: string | null; code: NumberedLine[] };

export type DeclarationUsage = SymbolDefinition & {
  uses: UsageSite[];
  useCount: number;
  callPaths: CallPath[];
  dependencies: Dependency[];
  otherDefinitions: SymbolDefinition[];
};

const MAX_DECLARATIONS = 6;
const MAX_USES = 8;
const MAX_USES_WITH_CODE = 4;
const MAX_OTHER_DEFINITIONS = 3;
const CODE_LINES_BEFORE = 2;
const CODE_LINES_AFTER = 6;

const MEMBER_KINDS: ReadonlySet<SymbolKind> = new Set(["method", "property"]);

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

function otherDefinitionsOf(index: UsageIndex, declaration: SymbolDefinition): SymbolDefinition[] {
  return index
    .definitionsOf(declaration.name, declaration.path)
    .filter((other) => !isSameDefinition(other, declaration) && !MEMBER_KINDS.has(other.kind))
    .slice(0, MAX_OTHER_DEFINITIONS);
}

function siteOf(index: UsageIndex, use: Reference, withCode: boolean): UsageSite {
  const caller = innermostAt(declarationsIn(index, use.path), use.line);
  const start = Math.max(1, use.line - CODE_LINES_BEFORE);
  return {
    ...use,
    caller: caller?.name ?? null,
    code: withCode ? numberedLines(index, use.path, start, use.line + CODE_LINES_AFTER) : [],
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

function codeUsesOutside(declaration: SymbolDefinition, references: Reference[]): Reference[] {
  const uses = references.filter(
    (reference) =>
      languageFor(reference.path) !== null &&
      !(reference.path === declaration.path && spans(declaration, reference.line)),
  );
  return [
    ...uses.filter((use) => isProductionCode(use.path)),
    ...uses.filter((use) => !isProductionCode(use.path)),
  ];
}

async function usageOf(
  index: UsageIndex,
  referencesOf: ReferencesOf,
  declaration: SymbolDefinition,
): Promise<DeclarationUsage> {
  const uses = codeUsesOutside(declaration, await referencesOf(declaration.name));
  return {
    ...declaration,
    uses: sitesOf(index, uses),
    useCount: uses.length,
    callPaths: await callPathsTo(index, declaration, referencesOf),
    dependencies: dependenciesOf(index, declaration),
    otherDefinitions: otherDefinitionsOf(index, declaration),
  };
}

function memoizedReferences(index: UsageIndex): ReferencesOf {
  const cache = new Map<string, Promise<Reference[]>>();
  return (name) => {
    if (!cache.has(name)) cache.set(name, index.referencesTo(name));
    return cache.get(name)!;
  };
}

export function usageContext(
  index: UsageIndex,
  path: string,
  lines: ReadonlySet<number>,
): Promise<DeclarationUsage[]> {
  const referencesOf = memoizedReferences(index);
  return Promise.all(
    declarationsOn(index, path, lines).map((declaration) =>
      usageOf(index, referencesOf, declaration),
    ),
  );
}

function countSummary(usage: DeclarationUsage): string {
  if (usage.useCount === 0) return "no uses outside its own definition";
  return usage.useCount === 1 ? "1 use elsewhere" : `${usage.useCount} uses elsewhere`;
}

function codeText(code: NumberedLine[], indent: string): string[] {
  return code.map((numbered) => `${indent}${numbered.line}: ${numbered.text}`);
}

function siteText(site: UsageSite): string[] {
  if (site.code.length === 0) return [`  ${site.path}:${site.line}: ${site.text.trim()}`];
  const where = site.caller ? ` in ${site.caller}` : "";
  return [`  ${site.path}:${site.line}${where}:`, ...codeText(site.code, "    ")];
}

function pathText(path: CallPath, target: string): string {
  const steps = path.steps.map((step) => `${step.name} (${step.call.path}:${step.call.line})`);
  const start = path.end === "more" ? "… → " : "";
  return `    ${start}${[...steps, target].join(" → ")}`;
}

function callPathsText(usage: DeclarationUsage): string[] {
  const paths = usage.callPaths.filter((path) => path.steps.length > 0);
  if (paths.length === 0) return [];
  return [
    "  Call paths, from where it is reached down to it:",
    ...paths.map((path) => pathText(path, usage.name)),
  ];
}

function dependencyText(dependency: Dependency): string[] {
  return [
    `    ${dependency.name} (${dependency.kind}) ${dependency.path}:${dependency.line}-${dependency.endLine}`,
    ...codeText(dependency.code, "      "),
  ];
}

function dependenciesText(usage: DeclarationUsage): string[] {
  if (usage.dependencies.length === 0) return [];
  return ["  Uses from elsewhere in the repo:", ...usage.dependencies.flatMap(dependencyText)];
}

function usageBlock(usage: DeclarationUsage): string {
  return [
    `${usage.name} (${usage.kind}) ${usage.path}:${usage.line}-${usage.endLine}, ${countSummary(usage)}`,
    ...usage.uses.flatMap(siteText),
    ...callPathsText(usage),
    ...dependenciesText(usage),
    ...usage.otherDefinitions.map(
      (other) => `  Also defined at: ${other.path}:${other.line} (${other.kind})`,
    ),
  ].join("\n");
}

export function usageText(usages: DeclarationUsage[]): string {
  return usages.map(usageBlock).join("\n");
}
