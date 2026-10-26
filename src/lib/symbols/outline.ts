import type { OutlineSymbol, SymbolDefinition } from "@/lib/types";

function byPosition(left: SymbolDefinition, right: SymbolDefinition): number {
  return left.line - right.line || right.endLine - left.endLine;
}

function contains(outer: OutlineSymbol, inner: SymbolDefinition): boolean {
  return inner.line >= outer.line && inner.endLine <= outer.endLine;
}

export function outlineOf(definitions: SymbolDefinition[]): OutlineSymbol[] {
  const roots: OutlineSymbol[] = [];
  const open: OutlineSymbol[] = [];
  const shown = definitions.filter((definition) => definition.kind !== "parameter");
  for (const definition of shown.toSorted(byPosition)) {
    while (open.length > 0 && !contains(open[open.length - 1], definition)) open.pop();
    const node: OutlineSymbol = { ...definition, children: [] };
    (open.length > 0 ? open[open.length - 1].children : roots).push(node);
    open.push(node);
  }
  return roots;
}
