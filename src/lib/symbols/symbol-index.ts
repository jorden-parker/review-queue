import fs from "node:fs";
import path from "node:path";
import { runCommand, type Runner } from "@/lib/exec";
import type { SymbolDefinition } from "@/lib/types";
import { languageFor } from "./languages";
import { parseDefinitions } from "./parse";

export type Reference = { path: string; line: number; text: string };

const MAX_FILES = 6000;
const MAX_LISTED_FILES = 20000;
export const MAX_FILE_BYTES = 300 * 1024;
const MAX_REFERENCES = 60;
const MAX_DEFINITIONS = 20;
const MAX_MENTIONING_FILES = 300;
const IGNORED_SEGMENTS = /(^|\/)(node_modules|vendor|dist|build|\.next|third_party)\//;

function sharedPrefixLength(a: string, b: string): number {
  const left = a.split("/");
  const right = b.split("/");
  let shared = 0;
  while (shared < left.length && shared < right.length && left[shared] === right[shared]) shared++;
  return shared;
}

function isIndexable(file: string): boolean {
  return languageFor(file) !== null && !IGNORED_SEGMENTS.test(file);
}

function parseGrepLine(line: string): Reference | null {
  const match = line.match(/^(.+?):(\d+):(.*)$/s);
  if (!match) return null;
  return { path: match[1], line: Number(match[2]), text: match[3] };
}

function readStart(file: string, maxBytes: number): string {
  const descriptor = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(descriptor, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    fs.closeSync(descriptor);
  }
}

export class SymbolIndex {
  private readonly byName = new Map<string, SymbolDefinition[]>();
  private readonly byFile = new Map<string, SymbolDefinition[]>();

  private constructor(
    readonly root: string,
    private readonly run: Runner,
  ) {}

  static async build(root: string, run: Runner = runCommand): Promise<SymbolIndex> {
    const index = new SymbolIndex(root, run);
    const listing = await run("git", ["ls-files"], { cwd: root });
    const files = listing.split("\n").filter(isIndexable).slice(0, MAX_FILES);
    for (const file of files) await index.addFile(file);
    return index;
  }

  async listFiles(): Promise<string[]> {
    const listing = await this.run("git", ["ls-files"], { cwd: this.root });
    return listing
      .split("\n")
      .filter((file) => file !== "")
      .slice(0, MAX_LISTED_FILES);
  }

  hasName(name: string): boolean {
    return this.byName.has(name);
  }

  definitionsIn(file: string): SymbolDefinition[] {
    return this.byFile.get(file) ?? [];
  }

  definitionsOf(name: string, fromFile: string): SymbolDefinition[] {
    const candidates = this.byName.get(name) ?? [];
    return [...candidates]
      .sort(
        (a, b) =>
          Number(b.path === fromFile) - Number(a.path === fromFile) ||
          sharedPrefixLength(b.path, fromFile) - sharedPrefixLength(a.path, fromFile) ||
          a.path.localeCompare(b.path),
      )
      .slice(0, MAX_DEFINITIONS);
  }

  async referencesTo(name: string): Promise<Reference[]> {
    const output = await this.run("git", ["grep", "-n", "-w", "-F", "-I", "-e", name], {
      cwd: this.root,
    }).catch(() => "");
    return output
      .split("\n")
      .map(parseGrepLine)
      .filter((reference): reference is Reference => reference !== null)
      .filter((reference) => !IGNORED_SEGMENTS.test(reference.path))
      .slice(0, MAX_REFERENCES);
  }

  async filesMentioning(name: string): Promise<string[]> {
    const output = await this.run("git", ["grep", "-l", "-w", "-F", "-I", "-e", name], {
      cwd: this.root,
    }).catch(() => "");
    return output
      .split("\n")
      .filter((file) => file !== "" && !IGNORED_SEGMENTS.test(file))
      .slice(0, MAX_MENTIONING_FILES);
  }

  relativePath(absolute: string): string | null {
    const root = fs.realpathSync(this.root) + path.sep;
    const resolved = fs.existsSync(absolute) ? fs.realpathSync(absolute) : absolute;
    return resolved.startsWith(root) ? resolved.slice(root.length) : null;
  }

  readFile(file: string): string {
    const absolute = fs.realpathSync(path.resolve(this.root, file));
    if (this.relativePath(absolute) === null) throw new Error(`Path outside checkout: ${file}`);
    return readStart(absolute, MAX_FILE_BYTES);
  }

  readLines(file: string, startLine: number, endLine: number): string[] {
    return this.readFile(file)
      .split("\n")
      .slice(startLine - 1, endLine);
  }

  private async addFile(file: string): Promise<void> {
    const absolute = path.join(this.root, file);
    const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (!stat?.isFile() || stat.size > MAX_FILE_BYTES) return;
    const definitions = await parseDefinitions(file, fs.readFileSync(absolute, "utf8"));
    this.byFile.set(file, definitions);
    for (const definition of definitions) {
      const existing = this.byName.get(definition.name) ?? [];
      existing.push(definition);
      this.byName.set(definition.name, existing);
    }
  }
}
