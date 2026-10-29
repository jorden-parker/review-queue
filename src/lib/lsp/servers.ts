import path from "node:path";

export type LanguageServer = {
  id: "typescript" | "go" | "python" | "rust";
  languageIds: Record<string, string>;
  command: string;
  args: string[];
  env: Record<string, string>;
  initializationOptions: unknown;
  settings: unknown;
  optInVariable?: string;
};

function installedPath(...segments: string[]): string {
  return path.join(process.cwd(), "node_modules", ...segments);
}

const TYPESCRIPT: LanguageServer = {
  id: "typescript",
  languageIds: {
    ".ts": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "javascriptreact",
  },
  command: installedPath(".bin", "typescript-language-server"),
  args: ["--stdio"],
  env: {},
  initializationOptions: {
    tsserver: { path: installedPath("typescript", "lib", "tsserver.js"), useSyntaxServer: "never" },
    plugins: [],
    disableAutomaticTypingAcquisition: true,
    preferences: { includeCompletionsForModuleExports: false },
  },
  settings: {},
};

const GO: LanguageServer = {
  id: "go",
  languageIds: { ".go": "go" },
  command: "gopls",
  args: ["serve"],
  env: {
    GOFLAGS: "-mod=readonly",
    GOPROXY: "off",
    GOTOOLCHAIN: "local",
    CGO_ENABLED: "0",
    GOWORK: "off",
  },
  initializationOptions: { codelenses: {}, semanticTokens: false },
  settings: {},
};

const PYTHON: LanguageServer = {
  id: "python",
  languageIds: { ".py": "python" },
  command: "pyright-langserver",
  args: ["--stdio"],
  env: { PYTHONSAFEPATH: "1" },
  initializationOptions: {},
  settings: { python: { analysis: { autoSearchPaths: false, diagnosticMode: "openFilesOnly" } } },
};

const RUST_SETTINGS = {
  cargo: { buildScripts: { enable: false }, allTargets: false },
  procMacro: { enable: false },
  checkOnSave: false,
  cachePriming: { enable: false },
};

const RUST: LanguageServer = {
  id: "rust",
  languageIds: { ".rs": "rust" },
  command: "rust-analyzer",
  args: [],
  env: {
    RUSTC_WRAPPER: "",
    CARGO_BUILD_RUSTC_WRAPPER: "",
    CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER: "",
    CARGO_BUILD_RUSTC: "rustc",
    RUSTUP_TOOLCHAIN: "stable",
    CARGO_NET_OFFLINE: "true",
    RUSTUP_AUTO_INSTALL: "0",
  },
  initializationOptions: RUST_SETTINGS,
  settings: { "rust-analyzer": RUST_SETTINGS },
  optInVariable: "REVIEW_QUEUE_LSP_RUST",
};

const SERVERS = [TYPESCRIPT, GO, PYTHON, RUST];

function isEnabled(server: LanguageServer): boolean {
  return !server.optInVariable || process.env[server.optInVariable] === "on";
}

export function serverFor(file: string): LanguageServer | null {
  const extension = path.extname(file);
  const server = SERVERS.find((candidate) => extension in candidate.languageIds);
  return server && isEnabled(server) ? server : null;
}

export function languageIdOf(server: LanguageServer, file: string): string {
  return server.languageIds[path.extname(file)];
}
