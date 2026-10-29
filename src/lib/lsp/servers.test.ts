import { afterEach, describe, expect, it, vi } from "vitest";
import { serverFor } from "./servers";

describe("serverFor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("picks a server by file extension", () => {
    expect(serverFor("src/app.tsx")?.id).toBe("typescript");
    expect(serverFor("main.go")?.id).toBe("go");
    expect(serverFor("README.md")).toBeNull();
  });

  it("leaves rust-analyzer off unless it is opted in, because repo config can re-enable build scripts", () => {
    expect(serverFor("src/lib.rs")).toBeNull();
    vi.stubEnv("REVIEW_QUEUE_LSP_RUST", "on");
    expect(serverFor("src/lib.rs")?.id).toBe("rust");
  });

  it("runs tsserver with no plugins, no type acquisition and the bundled binary", () => {
    const tsserverOptions = serverFor("src/app.ts")?.initializationOptions as {
      tsserver: { path: string };
    };
    expect(tsserverOptions).toMatchObject({
      tsserver: { useSyntaxServer: "never" },
      plugins: [],
      disableAutomaticTypingAcquisition: true,
    });
    expect(tsserverOptions.tsserver.path).toMatch(/node_modules\/typescript\/lib\/tsserver\.js$/);
    expect(serverFor("src/app.ts")?.env).toEqual({});
  });

  it("keeps gopls offline, on the local toolchain, without cgo or a workspace file", () => {
    expect(serverFor("main.go")?.env).toEqual({
      GOFLAGS: "-mod=readonly",
      GOPROXY: "off",
      GOTOOLCHAIN: "local",
      CGO_ENABLED: "0",
      GOWORK: "off",
    });
  });

  it("keeps pyright off the checkout's import path and search paths", () => {
    expect(serverFor("app.py")?.env).toEqual({ PYTHONSAFEPATH: "1" });
    expect(serverFor("app.py")?.settings).toMatchObject({
      python: { analysis: { autoSearchPaths: false, diagnosticMode: "openFilesOnly" } },
    });
  });

  it("keeps rust-analyzer from building, expanding macros, downloading or using repo wrappers", () => {
    vi.stubEnv("REVIEW_QUEUE_LSP_RUST", "on");
    const rust = serverFor("src/lib.rs");
    expect(rust?.env).toEqual({
      RUSTC_WRAPPER: "",
      CARGO_BUILD_RUSTC_WRAPPER: "",
      CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER: "",
      CARGO_BUILD_RUSTC: "rustc",
      RUSTUP_TOOLCHAIN: "stable",
      CARGO_NET_OFFLINE: "true",
      RUSTUP_AUTO_INSTALL: "0",
    });
    const sandbox = {
      cargo: { buildScripts: { enable: false }, allTargets: false },
      procMacro: { enable: false },
      checkOnSave: false,
      cachePriming: { enable: false },
    };
    expect(rust?.initializationOptions).toEqual(sandbox);
    expect(rust?.settings).toEqual({ "rust-analyzer": sandbox });
  });
});
