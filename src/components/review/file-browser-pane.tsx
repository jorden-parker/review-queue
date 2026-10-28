"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Callout } from "@/components/common/callout";
import { EmptyState } from "@/components/common/empty-state";
import { PaneRow } from "@/components/common/pane-row";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { PullRequestRef } from "@/lib/types";
import { fetchWorktreeFiles } from "./api";
import { buildFileTree, type FileTreeNode, filterPaths } from "./file-tree";
import type { LineTarget } from "./locate";

const MAX_FLAT_RESULTS = 200;

type FileBrowserPaneProps = {
  pullRequest: PullRequestRef;
  headSha: string;
  inPullRequest: (path: string) => boolean;
  onOpen: (target: LineTarget) => void;
};

type ListState = { paths: string[] | null; failed: boolean };

function useWorktreeFiles(pullRequest: PullRequestRef, headSha: string): ListState {
  const [state, setState] = useState<ListState>({ paths: null, failed: false });
  useEffect(() => {
    fetchWorktreeFiles(pullRequest, headSha)
      .then(({ paths }) => setState({ paths, failed: false }))
      .catch(() => setState({ paths: null, failed: true }));
  }, [pullRequest, headSha]);
  return state;
}

function useExpandedFolders() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (folder: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  return { expanded, toggle };
}

function FileRow({
  path,
  changed,
  onOpen,
  label,
}: {
  path: string;
  changed: boolean;
  onOpen: (path: string) => void;
  label: ReactNode;
}) {
  return (
    <PaneRow className="group">
      <button
        onClick={() => onOpen(path)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
      >
        <span className="min-w-0 flex-1 wrap-anywhere">{label}</span>
        {changed && <Badge variant="secondary">In this PR</Badge>}
      </button>
    </PaneRow>
  );
}

type TreeProps = {
  nodes: FileTreeNode[];
  expanded: Set<string>;
  onToggle: (folder: string) => void;
  inPullRequest: (path: string) => boolean;
  onOpen: (path: string) => void;
};

function TreeNodes({ nodes, expanded, onToggle, inPullRequest, onOpen }: TreeProps) {
  return (
    <ul className="flex flex-col">
      {nodes.map((node) =>
        node.children === null ? (
          <FileRow
            key={node.path}
            path={node.path}
            changed={inPullRequest(node.path)}
            onOpen={onOpen}
            label={<span className="font-mono">{node.name}</span>}
          />
        ) : (
          <FolderNode
            key={node.path}
            node={node}
            nodes={node.children}
            expanded={expanded}
            onToggle={onToggle}
            inPullRequest={inPullRequest}
            onOpen={onOpen}
          />
        ),
      )}
    </ul>
  );
}

function FolderNode({
  node,
  nodes,
  expanded,
  onToggle,
  inPullRequest,
  onOpen,
}: TreeProps & { node: FileTreeNode; nodes: FileTreeNode[] }) {
  const open = expanded.has(node.path);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <>
      <PaneRow>
        <button
          aria-expanded={open}
          onClick={() => onToggle(node.path)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm"
        >
          <Chevron className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="font-mono wrap-anywhere">{node.name}</span>
        </button>
      </PaneRow>
      {open && (
        <li className="ml-3">
          <TreeNodes
            nodes={nodes}
            expanded={expanded}
            onToggle={onToggle}
            inPullRequest={inPullRequest}
            onOpen={onOpen}
          />
        </li>
      )}
    </>
  );
}

function FlatResults({
  paths,
  query,
  inPullRequest,
  onOpen,
}: {
  paths: string[];
  query: string;
  inPullRequest: (path: string) => boolean;
  onOpen: (path: string) => void;
}) {
  const matches = filterPaths(paths, query);
  if (matches.length === 0) {
    return <EmptyState emoji="🔎">No file matches &ldquo;{query}&rdquo;.</EmptyState>;
  }
  const shown = matches.slice(0, MAX_FLAT_RESULTS);
  const hidden = matches.length - shown.length;
  return (
    <>
      <ul className="flex flex-col">
        {shown.map((path) => (
          <FileRow
            key={path}
            path={path}
            changed={inPullRequest(path)}
            onOpen={onOpen}
            label={<PathLabel path={path} />}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <p className="pt-2 text-xs text-muted-foreground">
          {hidden} more match. Narrow the filter.
        </p>
      )}
    </>
  );
}

function FileList({
  paths,
  query,
  inPullRequest,
  onOpen,
}: {
  paths: string[];
  query: string;
  inPullRequest: (path: string) => boolean;
  onOpen: (path: string) => void;
}) {
  const tree = useMemo(() => buildFileTree(paths), [paths]);
  const { expanded, toggle } = useExpandedFolders();
  if (query.trim() !== "") {
    return (
      <FlatResults paths={paths} query={query} inPullRequest={inPullRequest} onOpen={onOpen} />
    );
  }
  return (
    <TreeNodes
      nodes={tree}
      expanded={expanded}
      onToggle={toggle}
      inPullRequest={inPullRequest}
      onOpen={onOpen}
    />
  );
}

export function FileBrowserPane({
  pullRequest,
  headSha,
  inPullRequest,
  onOpen,
}: FileBrowserPaneProps) {
  const { paths, failed } = useWorktreeFiles(pullRequest, headSha);
  const [query, setQuery] = useState("");
  const openFile = (path: string) => onOpen({ path, line: 1 });
  if (failed) return <Callout tone="error">Could not list the files.</Callout>;
  if (!paths) return <p className="text-sm text-muted-foreground">Loading files…</p>;
  return (
    <div className="flex flex-col gap-3">
      <Input
        aria-label="Filter files"
        placeholder="Filter files"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {paths.length === 0 ? (
        <EmptyState emoji="📂">This commit has no tracked files.</EmptyState>
      ) : (
        <FileList paths={paths} query={query} inPullRequest={inPullRequest} onOpen={openFile} />
      )}
    </div>
  );
}
