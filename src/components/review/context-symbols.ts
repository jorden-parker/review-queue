import type { DefinitionWithCode } from "@/lib/review/peek-code";
import type { ContextSymbol, SeenSymbol } from "@/lib/session/store";
import type { SymbolKind, SymbolPosition } from "@/lib/types";
import type { PeekState } from "./use-peek";

export type ContextView = "pinned" | "step" | "all";
export type KindGroup = "functions" | "types" | "values" | "library";
export type ContextFilter = { view: ContextView; shown: KindGroup[] };

export const ALL_KIND_GROUPS: KindGroup[] = ["functions", "types", "values", "library"];

const KIND_GROUPS: Record<SymbolKind, KindGroup> = {
  function: "functions",
  method: "functions",
  class: "types",
  interface: "types",
  type: "types",
  enum: "types",
  module: "types",
  variable: "values",
  constant: "values",
  parameter: "values",
  property: "values",
};

function kindGroupOf(symbol: ContextSymbol): KindGroup {
  return symbol.scope === "external" ? "library" : KIND_GROUPS[symbol.kind];
}

function inView(symbol: ContextSymbol, stepId: string | null, view: ContextView): boolean {
  if (view === "pinned") return symbol.pinned;
  if (view === "step") return symbol.stepId === stepId;
  return true;
}

export function visibleSymbols(
  symbols: ContextSymbol[],
  stepId: string | null,
  filter: ContextFilter,
): ContextSymbol[] {
  return symbols
    .filter((symbol) => inView(symbol, stepId, filter.view))
    .filter((symbol) => filter.shown.includes(kindGroupOf(symbol)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

export function contextCount(symbols: ContextSymbol[], stepId: string | null): number {
  return symbols.filter((symbol) => symbol.pinned || symbol.stepId === stepId).length;
}

function sameSymbol(a: SeenSymbol, b: SeenSymbol): boolean {
  return a.name === b.name && a.path === b.path && a.line === b.line;
}

export function isPinned(symbols: ContextSymbol[], symbol: SeenSymbol): boolean {
  return symbols.some((entry) => entry.pinned && sameSymbol(entry, symbol));
}

export function withSymbol(
  symbols: ContextSymbol[],
  symbol: SeenSymbol,
  changes: { pinned?: boolean },
): ContextSymbol[] {
  const existing = symbols.find((entry) => sameSymbol(entry, symbol));
  const updated: ContextSymbol = {
    ...symbol,
    pinned: changes.pinned ?? existing?.pinned ?? false,
    seenAt: new Date().toISOString(),
  };
  return [updated, ...symbols.filter((entry) => !sameSymbol(entry, symbol))];
}

export function seenSymbolOf(
  definition: DefinitionWithCode,
  origin: SymbolPosition,
  stepId: string | null,
): SeenSymbol {
  const { name, kind, path, line, scope, signature } = definition;
  return { name, kind, path, line, scope, signature, stepId, origin };
}

export function peekedSymbol(peek: PeekState | null, stepId: string | null): SeenSymbol | null {
  const first = peek?.definitions?.[0];
  return peek && first ? seenSymbolOf(first, peek.position, stepId) : null;
}
