import type { SymbolIndex } from "@/lib/symbols/symbol-index";
import type { SymbolDefinition, SymbolKind } from "@/lib/types";
import { declarationsIn, isSameDefinition, spans } from "./declarations";

export type NumberedLine = { line: number; text: string };

export type Dependency = SymbolDefinition & { code: NumberedLine[] };

type DependencyIndex = Pick<SymbolIndex, "definitionsIn" | "definitionsOf" | "readLines">;

const MAX_DEPENDENCIES = 8;
const MAX_DEPENDENCY_LINES = 6;
const MEMBER_KINDS: ReadonlySet<SymbolKind> = new Set(["method", "property"]);
const BARE_IDENTIFIER = /(?<![\w$.])[A-Za-z_$][\w$]*/g;
const IMPORT_STATEMENT =
  /^\s*(?:import\b[^;]*?\bfrom\b|from\s+\S+\s+import\b[^\n]*|import\b[^\n]*)/gm;

export function numberedLines(
  index: Pick<SymbolIndex, "readLines">,
  path: string,
  start: number,
  end: number,
): NumberedLine[] {
  return index.readLines(path, start, end).map((text, offset) => ({ line: start + offset, text }));
}

function namesUsedIn(index: DependencyIndex, declaration: SymbolDefinition): string[] {
  const body = index.readLines(declaration.path, declaration.line, declaration.endLine).join("\n");
  const ownNames = new Set(
    index
      .definitionsIn(declaration.path)
      .filter((definition) => spans(declaration, definition.line))
      .map((definition) => definition.name),
  );
  return [...new Set(body.match(BARE_IDENTIFIER) ?? [])].filter((name) => !ownNames.has(name));
}

function importedNames(index: DependencyIndex, declaration: SymbolDefinition): Set<string> {
  const header = index.readLines(declaration.path, 1, declaration.line - 1).join("\n");
  const statements = header.match(IMPORT_STATEMENT) ?? [];
  return new Set(statements.flatMap((statement) => statement.match(BARE_IDENTIFIER) ?? []));
}

function isDeclaration(index: DependencyIndex, definition: SymbolDefinition): boolean {
  return declarationsIn(index, definition.path).some((declaration) =>
    isSameDefinition(declaration, definition),
  );
}

function definitionUsed(
  index: DependencyIndex,
  declaration: SymbolDefinition,
  name: string,
  imported: ReadonlySet<string>,
): SymbolDefinition | null {
  return (
    index
      .definitionsOf(name, declaration.path)
      .find(
        (definition) =>
          (imported.has(name) || definition.path === declaration.path) &&
          !MEMBER_KINDS.has(definition.kind) &&
          !isSameDefinition(definition, declaration) &&
          isDeclaration(index, definition),
      ) ?? null
  );
}

export function dependenciesOf(
  index: DependencyIndex,
  declaration: SymbolDefinition,
): Dependency[] {
  const imported = importedNames(index, declaration);
  return namesUsedIn(index, declaration)
    .map((name) => definitionUsed(index, declaration, name, imported))
    .filter((definition): definition is SymbolDefinition => definition !== null)
    .slice(0, MAX_DEPENDENCIES)
    .map((definition) => ({
      ...definition,
      code: numberedLines(
        index,
        definition.path,
        definition.line,
        Math.min(definition.endLine, definition.line + MAX_DEPENDENCY_LINES - 1),
      ),
    }));
}
