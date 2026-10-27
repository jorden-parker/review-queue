import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/node";
import type {
  Hover,
  Location,
  LocationLink,
  MarkedString,
  MarkupContent,
} from "vscode-languageserver-protocol";
import { spawnProcess } from "@/lib/exec";
import { languageIdOf, type LanguageServer } from "./servers";

export type ServerLocation = { file: string; line: number; character: number; endLine: number };

export type ReadSource = (file: string) => string;

const DEFAULT_TIMEOUT_MS = 8000;

function requestTimeout(): number {
  const configured = Number(process.env.REVIEW_QUEUE_LSP_TIMEOUT_MS);
  return configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function withTimeout<T>(request: Promise<T>, label: string): Promise<T> {
  const milliseconds = requestTimeout();
  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
  });
  return Promise.race([request, expiry]).finally(() => clearTimeout(timer));
}

function isLink(location: Location | LocationLink): location is LocationLink {
  return "targetUri" in location;
}

function toServerLocation(location: Location | LocationLink): ServerLocation {
  const uri = isLink(location) ? location.targetUri : location.uri;
  const start = isLink(location) ? location.targetSelectionRange.start : location.range.start;
  const end = isLink(location) ? location.targetRange.end : location.range.end;
  return {
    file: fileURLToPath(uri),
    line: start.line + 1,
    character: start.character,
    endLine: Math.max(end.line + 1, start.line + 1),
  };
}

function locationsOf(result: Location | Location[] | LocationLink[] | null): ServerLocation[] {
  if (!result) return [];
  return (Array.isArray(result) ? result : [result]).map(toServerLocation);
}

function markedText(content: MarkedString | MarkupContent): string {
  if (typeof content === "string") return content;
  if ("language" in content) return `\`\`\`${content.language}\n${content.value}\n\`\`\``;
  return content.value;
}

function hoverText(hover: Hover | null): string | null {
  if (!hover) return null;
  const parts = Array.isArray(hover.contents) ? hover.contents : [hover.contents];
  const text = parts.map(markedText).join("\n\n").trim();
  return text || null;
}

const CLIENT_CAPABILITIES = {
  textDocument: {
    definition: { linkSupport: true },
    references: {},
    hover: { contentFormat: ["markdown", "plaintext"] },
    synchronization: { didSave: false },
  },
  workspace: { configuration: true, workspaceFolders: true },
};

export class LanguageClient {
  private readonly opened = new Set<string>();

  private constructor(
    private readonly server: LanguageServer,
    private readonly root: string,
    private readonly connection: MessageConnection,
    private readonly readSource: ReadSource,
  ) {}

  static async start(
    server: LanguageServer,
    root: string,
    readSource: ReadSource,
  ): Promise<LanguageClient> {
    const child = spawnProcess(server.command, server.args, { cwd: root, env: server.env });
    const spawned = new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.stderr.resume();
    await spawned;
    const connection = createMessageConnection(
      new StreamMessageReader(child.stdout),
      new StreamMessageWriter(child.stdin),
    );
    connection.onRequest("workspace/configuration", (params: { items: unknown[] }) =>
      params.items.map(() => server.settings),
    );
    connection.onRequest(() => null);
    connection.onClose(() => child.kill());
    connection.listen();
    const client = new LanguageClient(server, root, connection, readSource);
    await client.initialize();
    return client;
  }

  async definition(file: string, line: number, character: number): Promise<ServerLocation[]> {
    const result = await this.request<Location | Location[] | LocationLink[] | null>(
      "textDocument/definition",
      file,
      { position: { line: line - 1, character } },
    );
    return locationsOf(result);
  }

  async references(
    file: string,
    line: number,
    character: number,
    related: string[] = [],
  ): Promise<ServerLocation[]> {
    await Promise.all(
      related.filter((other) => this.serves(other)).map((other) => this.open(other)),
    );
    const result = await this.request<Location[] | null>("textDocument/references", file, {
      position: { line: line - 1, character },
      context: { includeDeclaration: false },
    });
    return locationsOf(result);
  }

  async hover(file: string, line: number, character: number): Promise<string | null> {
    const result = await this.request<Hover | null>("textDocument/hover", file, {
      position: { line: line - 1, character },
    });
    return hoverText(result);
  }

  async stop(): Promise<void> {
    await withTimeout(this.connection.sendRequest("shutdown"), "shutdown").catch(() => null);
    await this.connection.sendNotification("exit").catch(() => null);
    this.connection.dispose();
  }

  private async initialize(): Promise<void> {
    const rootUri = pathToFileURL(this.root).href;
    await withTimeout(
      this.connection.sendRequest("initialize", {
        processId: process.pid,
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: path.basename(this.root) }],
        capabilities: CLIENT_CAPABILITIES,
        initializationOptions: this.server.initializationOptions,
      }),
      "initialize",
    );
    await this.connection.sendNotification("initialized", {});
    await this.connection.sendNotification("workspace/didChangeConfiguration", {
      settings: this.server.settings,
    });
  }

  private serves(file: string): boolean {
    return languageIdOf(this.server, file) !== undefined;
  }

  private uriOf(file: string): string {
    return pathToFileURL(path.join(this.root, file)).href;
  }

  private async open(file: string): Promise<void> {
    if (this.opened.has(file)) return;
    this.opened.add(file);
    await this.connection.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: this.uriOf(file),
        languageId: languageIdOf(this.server, file),
        version: 1,
        text: this.readSource(file),
      },
    });
  }

  private async request<T>(method: string, file: string, params: object): Promise<T> {
    await this.open(file);
    return withTimeout(
      this.connection.sendRequest<T>(method, {
        textDocument: { uri: this.uriOf(file) },
        ...params,
      }),
      method,
    );
  }
}
