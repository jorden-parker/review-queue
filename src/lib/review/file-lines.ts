import { highlightLines, type Token } from "@/lib/highlight";
import { MAX_FILE_BYTES, type SymbolIndex } from "@/lib/symbols/symbol-index";

export type FileLines = { tokens: Token[][]; truncated: boolean };

type FileReader = Pick<SymbolIndex, "readFile">;

function readOrNull(reader: FileReader, path: string): string | null {
  try {
    return reader.readFile(path);
  } catch {
    return null;
  }
}

function linesOf(text: string): string[] {
  const lines = text.split("\n");
  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

export async function fileLines(reader: FileReader, path: string): Promise<FileLines | null> {
  const text = readOrNull(reader, path);
  if (text === null) return null;
  return {
    tokens: await highlightLines(path, linesOf(text)),
    truncated: Buffer.byteLength(text) >= MAX_FILE_BYTES,
  };
}
