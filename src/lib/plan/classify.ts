import path from "node:path";
import type { FileRole } from "@/lib/types";

const GENERATED = [
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|go\.sum|Cargo\.lock|poetry\.lock|uv\.lock|Gemfile\.lock|composer\.lock)$/,
  /(\.pb\.go|_pb2\.py|\.generated\.\w+|\.min\.(js|css)|\.snap|\.map)$/,
  /(^|\/)(gen|generated|dist|build|vendor|__generated__|__snapshots__)\//,
];
const TEST = [
  /(\.|_)(test|spec)\.\w+$/,
  /_test\.go$/,
  /(^|\/)test_[^/]+\.py$/,
  /(^|\/)(tests?|__tests__|spec|e2e)\//,
];
const TYPES = [
  /\.d\.ts$/,
  /(^|\/)(types?|models?|schemas?|interfaces?|entities)(\.\w+|\/)/,
  /\.(proto|graphql|gql|prisma|sql)$/,
  /(^|\/)migrations?\//,
];
const CALLER = [
  /(^|\/)(app|pages|routes?|handlers?|controllers?|cmd|cli|views?|screens?|api)\//,
  /(^|\/)(main|index|server|app)\.\w+$/,
];
const CONFIG_FILES =
  /(^|\/)(package\.json|tsconfig[^/]*\.json|go\.mod|Cargo\.toml|pyproject\.toml|Dockerfile|Makefile|\.[^/]+rc(\.\w+)?|[^/]+\.config\.\w+)$/;
const CONFIG_DIRS = /(^|\/)(\.github|\.circleci|deploy|infra|k8s|helm)\//;
const CONFIG_EXTENSIONS = new Set([".yml", ".yaml", ".toml", ".ini", ".env", ".json"]);
const DOC_EXTENSIONS = new Set([".md", ".mdx", ".rst", ".txt", ".adoc"]);

function matchesAny(file: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(file));
}

function isConfig(file: string): boolean {
  return (
    CONFIG_FILES.test(file) || CONFIG_DIRS.test(file) || CONFIG_EXTENSIONS.has(path.extname(file))
  );
}

export function classifyFile(file: string): FileRole {
  if (matchesAny(file, GENERATED)) return "generated";
  if (matchesAny(file, TEST)) return "test";
  if (DOC_EXTENSIONS.has(path.extname(file))) return "docs";
  if (isConfig(file)) return "config";
  if (matchesAny(file, TYPES)) return "types";
  if (matchesAny(file, CALLER)) return "caller";
  return "core";
}
