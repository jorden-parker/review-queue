import path from "node:path";

const IMPORT_STATEMENT =
  /^\s*(import\b|export\s*(type\s+)?(\*(\s+as\s+\w+)?|\{[^}]*\})\s*from\b|from\s+\S+\s+import\b|use\b|(const|let|var)\s*\{?[^}=]*\}?\s*=\s*require\s*\()/;
const MODULE_SPECIFIER = /\bfrom\s+["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']\s*\)/;
const PACKAGE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*/i;
const SOURCE_EXTENSION = /\.(d\.ts|[cm]?[jt]sx?|py|rs|go)$/;

export type LinkedPackageDirectory = (name: string) => string | null;

export function isImportStatement(statement: string): boolean {
  return IMPORT_STATEMENT.test(statement);
}

export function moduleSpecifierOf(statement: string): string | null {
  const match = statement.match(MODULE_SPECIFIER);
  return match?.[1] ?? match?.[2] ?? null;
}

function withoutExtension(file: string): string {
  return file.replace(SOURCE_EXTENSION, "");
}

function relativeTarget(fromFile: string, specifier: string): string {
  const joined = path.posix.join(path.posix.dirname(fromFile), specifier);
  return withoutExtension(path.posix.normalize(joined));
}

export function importSourceOf(
  fromFile: string,
  statement: string,
  linkedPackageDirectory: LinkedPackageDirectory,
): string | null {
  const specifier = moduleSpecifierOf(statement);
  if (!specifier) return null;
  if (specifier.startsWith(".")) return relativeTarget(fromFile, specifier);
  const name = specifier.match(PACKAGE_NAME)?.[0];
  return name ? linkedPackageDirectory(name) : null;
}

function isUnder(file: string, source: string): boolean {
  return withoutExtension(file) === source || file.startsWith(`${source}/`);
}

export function rankByImportSource<T extends { path: string }>(
  items: T[],
  source: string | null,
): T[] {
  if (source === null) return items;
  return [...items].sort(
    (a, b) => Number(isUnder(b.path, source)) - Number(isUnder(a.path, source)),
  );
}
