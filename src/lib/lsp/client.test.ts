import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LanguageClient } from "./client";
import { serverFor } from "./servers";

const STORE = "export function load(id: string) {\n  return id;\n}\n";
const APP = [
  "import { load } from './store';",
  "export function run(load: number) {",
  "  const total = load + 1;",
  "  console.log(total);",
  "}",
  "export const start = () => load;",
  "",
].join("\n");

describe("LanguageClient with typescript-language-server", () => {
  let root: string;
  let client: LanguageClient;

  beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "lsp-client-")));
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "src/store.ts"), STORE);
    fs.writeFileSync(path.join(root, "src/app.ts"), APP);
    fs.writeFileSync(path.join(root, "tsconfig.json"), '{"compilerOptions":{"strict":true}}');
    client = await LanguageClient.start(serverFor("src/app.ts")!, root, (file) =>
      fs.readFileSync(path.join(root, file), "utf8"),
    );
  }, 30_000);

  afterAll(async () => {
    await client.stop();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("resolves a parameter to its own declaration rather than a same-named import", async () => {
    const [location] = await client.definition("src/app.ts", 3, 16);
    expect(location).toMatchObject({ file: path.join(root, "src/app.ts"), line: 2 });
  });

  it("resolves an imported name through to its source file", async () => {
    const [location] = await client.definition("src/app.ts", 6, 27);
    expect(location).toMatchObject({ file: path.join(root, "src/store.ts"), line: 1 });
    expect(location.endLine).toBe(3);
  });

  it("finds references and hover text", async () => {
    const references = await client.references("src/app.ts", 3, 8);
    expect(references.map((location) => location.line)).toEqual([4]);
    expect(await client.hover("src/app.ts", 3, 8)).toContain("const total: number");
  });

  it("reports library definitions with their real location", async () => {
    const [location] = await client.definition("src/app.ts", 4, 2);
    expect(location.file).not.toContain(root);
  });
});
