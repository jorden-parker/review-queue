"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Callout } from "@/components/common/callout";
import { EmptyState } from "@/components/common/empty-state";
import { PaneRow } from "@/components/common/pane-row";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PullRequestRef } from "@/lib/types";
import type { Reference } from "@/lib/symbols/symbol-index";
import { fetchSearch, fetchWorktreeFiles } from "./api";
import { buildFileTree, type FileTreeNode, filterPaths } from "./file-tree";
import type { LineTarget } from "./locate";

const MAX_FLAT_RESULTS = 200;
const SEARCH_RESULT_LIMIT = 200;
const SEARCH_DEBOUNCE_MS = 250;

type SearchMode = "names" | "text";

type FileBrowserPaneProps = {
  pullRequest: PullRequestRef;
  headSha: string;
  inPullRequest: (path: string) => boolean;
  onOpen: (target: LineTarget) => void;
};

type ListState = { paths: string[] | null; failed: boolean };

type TextSearchState = { query: string; results: Reference[] | null; failed: boolean };

function useDebouncedValue<Value>(value: Value, delayMs: number): Value {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function useTextSearch(
  pullRequest: PullRequestRef,
  headSha: string,
  text: string,
): TextSearchState {
  const [state, setState] = useState<TextSearchState>({ query: "", results: null, failed: false });
  useEffect(() => {
    if (text.trim() === "") return;
    let current = true;
    fetchSearch(pullRequest, headSha, text)
      .then(({ results }) => {
        if (current) setState({ query: text, results, failed: false });
      })
      .catch(() => {
        if (current) setState({ query: text, results: null, failed: true });
      });
    return () => {
      current = false;
    };
  }, [pullRequest, headSha, text]);
  return state;
}

function groupByPath(results: Reference[]): Map<string, Reference[]> {
  const groups = new Map<string, Reference[]>();
  for (const result of results) {
    groups.set(result.path, [...(groups.get(result.path) ?? []), result]);
  }
  return groups;
}

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

function NameResults({
  pullRequest,
  headSha,
  query,
  inPullRequest,
  onOpen,
}: {
  pullRequest: PullRequestRef;
  headSha: string;
  query: string;
  inPullRequest: (path: string) => boolean;
  onOpen: (path: string) => void;
}) {
  const { paths, failed } = useWorktreeFiles(pullRequest, headSha);
  if (failed) return <Callout tone="error">Could not list the files.</Callout>;
  if (!paths) return <p className="text-sm text-muted-foreground">Loading files…</p>;
  if (paths.length === 0) {
    return <EmptyState emoji="📂">This commit has no tracked files.</EmptyState>;
  }
  return <FileList paths={paths} query={query} inPullRequest={inPullRequest} onOpen={onOpen} />;
}

function TextResults({
  pullRequest,
  headSha,
  query,
  onOpen,
}: {
  pullRequest: PullRequestRef;
  headSha: string;
  query: string;
  onOpen: (target: LineTarget) => void;
}) {
  const settledQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const search = useTextSearch(pullRequest, headSha, settledQuery);
  if (settledQuery.trim() === "") {
    return <p className="text-sm text-muted-foreground">Type to search the text of every file.</p>;
  }
  if (search.query !== settledQuery) {
    return <p className="text-sm text-muted-foreground">Searching…</p>;
  }
  if (search.failed || search.results === null) {
    return <Callout tone="error">Could not search the files.</Callout>;
  }
  if (search.results.length === 0) {
    return <EmptyState emoji="🔎">No text matches &ldquo;{settledQuery}&rdquo;.</EmptyState>;
  }
  return (
    <>
      <MatchGroups results={search.results} onOpen={onOpen} />
      {search.results.length >= SEARCH_RESULT_LIMIT && (
        <p className="pt-2 text-xs text-muted-foreground">
          Showing the first {SEARCH_RESULT_LIMIT}.
        </p>
      )}
    </>
  );
}

function MatchGroups({
  results,
  onOpen,
}: {
  results: Reference[];
  onOpen: (target: LineTarget) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {[...groupByPath(results)].map(([path, matches]) => (
        <section key={path} className="flex flex-col gap-1">
          <PathLabel path={path} className="py-1" />
          <ul className="flex flex-col">
            {matches.map((match) => (
              <PaneRow key={match.line}>
                <button
                  onClick={() => onOpen({ path, line: match.line })}
                  className="flex w-full gap-3 text-left font-mono text-sm"
                >
                  <span className="w-8 shrink-0 text-right text-muted-foreground/70 select-none">
                    {match.line}
                  </span>
                  <span className="min-w-0 wrap-anywhere">{match.text}</span>
                </button>
              </PaneRow>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function FileBrowserPane({
  pullRequest,
  headSha,
  inPullRequest,
  onOpen,
}: FileBrowserPaneProps) {
  const [mode, setMode] = useState<SearchMode>("names");
  const [query, setQuery] = useState("");
  const openFile = (path: string) => onOpen({ path, line: 1 });
  const isText = mode === "text";
  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={mode}
        onValueChange={(value) => value && setMode(value as SearchMode)}
        aria-label="Search mode"
      >
        <ToggleGroupItem value="names">Names</ToggleGroupItem>
        <ToggleGroupItem value="text">Text</ToggleGroupItem>
      </ToggleGroup>
      <Input
        aria-label={isText ? "Search file text" : "Filter files"}
        placeholder={isText ? "Search file text" : "Filter files"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {isText ? (
        <TextResults pullRequest={pullRequest} headSha={headSha} query={query} onOpen={onOpen} />
      ) : (
        <NameResults
          pullRequest={pullRequest}
          headSha={headSha}
          query={query}
          inPullRequest={inPullRequest}
          onOpen={openFile}
        />
      )}
    </div>
  );
}
