import type { Reference, SymbolIndex } from "@/lib/symbols/symbol-index";
import type { SymbolDefinition, SymbolKind } from "@/lib/types";

export type UsageIndex = Pick<SymbolIndex, "definitionsIn" | "definitionsOf" | "referencesTo">;

export type DeclarationUsage = SymbolDefinition & {
  uses: Reference[];
  useCount: number;
  otherDefinitions: SymbolDefinition[];
};

const MAX_DECLARATIONS = 6;
const MAX_USES = 8;
const MAX_OTHER_DEFINITIONS = 3;

const LOCAL_KINDS: ReadonlySet<SymbolKind> = new Set(["variable", "constant", "property"]);
const MEMBER_KINDS: ReadonlySet<SymbolKind> = new Set(["method", "property"]);

function encloses(outer: SymbolDefinition, inner: SymbolDefinition): boolean {
  return outer !== inner && outer.line <= inner.line && inner.endLine <= outer.endLine;
}

function isLocal(definition: SymbolDefinition, all: SymbolDefinition[]): boolean {
  return (
    LOCAL_KINDS.has(definition.kind) &&
    all.some((other) => other.kind !== "parameter" && encloses(other, definition))
  );
}

function declarationsOn(
  index: UsageIndex,
  path: string,
  lines: ReadonlySet<number>,
): SymbolDefinition[] {
  const all = index.definitionsIn(path);
  return all
    .filter((definition) => lines.has(definition.line))
    .filter((definition) => definition.kind !== "parameter" && !isLocal(definition, all))
    .slice(0, MAX_DECLARATIONS);
}

function isInside(reference: Reference, definition: SymbolDefinition): boolean {
  return (
    reference.path === definition.path &&
    reference.line >= definition.line &&
    reference.line <= definition.endLine
  );
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

async function usageOf(
  index: UsageIndex,
  declaration: SymbolDefinition,
): Promise<DeclarationUsage> {
  const references = await index.referencesTo(declaration.name);
  const uses = references.filter((reference) => !isInside(reference, declaration));
  return {
    ...declaration,
    uses: uses.slice(0, MAX_USES),
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

function usageBlock(usage: DeclarationUsage): string {
  return [
    `${usage.name} (${usage.kind}) ${usage.path}:${usage.line}-${usage.endLine}, ${countSummary(usage)}`,
    ...usage.uses.map((use) => `  ${use.path}:${use.line}: ${use.text.trim()}`),
    ...usage.otherDefinitions.map(
      (other) => `  Also defined at: ${other.path}:${other.line} (${other.kind})`,
    ),
  ].join("\n");
}

export function usageText(usages: DeclarationUsage[]): string {
  return usages.map(usageBlock).join("\n");
}
