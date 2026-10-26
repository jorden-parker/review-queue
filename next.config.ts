import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@vscode/tree-sitter-wasm", "shiki"],
  agentRules: false,
};

export default nextConfig;
