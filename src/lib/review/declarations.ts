import type { SymbolIndex } from "@/lib/symbols/symbol-index";
import type { SymbolDefinition, SymbolKind } from "@/lib/types";

const LOCAL_KINDS: ReadonlySet<SymbolKind> = new Set(["variable", "constant", "property"]);

function encloses(outer: SymbolDefinition, inner: SymbolDefinition): boolean {
  return outer !== inner && outer.line <= inner.line && inner.endLine <= outer.endLine;
}

function isLocal(definition: SymbolDefinition, all: SymbolDefinition[]): boolean {
  return (
    LOCAL_KINDS.has(definition.kind) &&
    all.some((other) => other.kind !== "parameter" && encloses(other, definition))
  );
}

export function spans(definition: SymbolDefinition, line: number): boolean {
  return definition.line <= line && line <= definition.endLine;
}

export function isSameDefinition(a: SymbolDefinition, b: SymbolDefinition): boolean {
  return a.path === b.path && a.line === b.line;
}

export function declarationsIn(
  index: Pick<SymbolIndex, "definitionsIn">,
  path: string,
): SymbolDefinition[] {
  const all = index.definitionsIn(path);
  return all.filter((definition) => definition.kind !== "parameter" && !isLocal(definition, all));
}

export function innermostAt(
  declarations: SymbolDefinition[],
  line: number,
): SymbolDefinition | null {
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
