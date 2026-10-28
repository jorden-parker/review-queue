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

  it("never lets cargo pick up a wrapper from repo config", () => {
    vi.stubEnv("REVIEW_QUEUE_LSP_RUST", "on");
    expect(serverFor("src/lib.rs")?.env).toMatchObject({
      RUSTC_WRAPPER: "",
      CARGO_BUILD_RUSTC_WRAPPER: "",
      CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER: "",
    });
  });

  it("never lets cargo or rustup reach the network", () => {
    vi.stubEnv("REVIEW_QUEUE_LSP_RUST", "on");
    expect(serverFor("src/lib.rs")?.env).toMatchObject({
      CARGO_NET_OFFLINE: "true",
      RUSTUP_AUTO_INSTALL: "0",
    });
  });
});
