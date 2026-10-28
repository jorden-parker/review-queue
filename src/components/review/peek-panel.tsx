"use client";

import { ArrowRight, FoldVertical, Pin, PinOff, Telescope, UnfoldVertical, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Callout } from "@/components/common/callout";
import { EmptyState } from "@/components/common/empty-state";
import { HintButton } from "@/components/common/hint-button";
import { Markdown } from "@/components/common/markdown-text";
import { PaneRow } from "@/components/common/pane-row";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DefinitionWithCode } from "@/lib/review/peek-code";
import type { SymbolPosition } from "@/lib/types";
import { CodeTokens } from "./code-tokens";
import { CodeRows, WRAPPED_CODE } from "./code-rows";
import type { LineTarget } from "./locate";
import { groupReferencesByFile, type ReferenceGroup } from "./reference-groups";
import { useFileLines, type LoadFile } from "./use-file-lines";
import type { PeekState } from "./use-peek";

type PeekPanelProps = {
  peek: PeekState;
  inPullRequest: (path: string) => boolean;
  onIdentifier: (position: SymbolPosition) => void;
  onGoTo: (target: LineTarget) => void;
  onTab: (tab: PeekState["tab"]) => void;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  loadFile: LoadFile;
};

type PanelBodyProps = Omit<PeekPanelProps, "onTab" | "onClose" | "pinned" | "onTogglePin">;

function LoadingRows() {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-16 w-full" />
      ))}
    </div>
  );
}

const SCOPE_LABELS: Record<DefinitionWithCode["scope"], string | null> = {
  file: "this file",
  repo: null,
  external: "library",
};

type WholeFileToggle = { showFile: boolean; onToggle: () => void } | null;

function WholeFileButton({ toggle }: { toggle: NonNullable<WholeFileToggle> }) {
  return (
    <Button variant="ghost" size="xs" onClick={toggle.onToggle} aria-pressed={toggle.showFile}>
      {toggle.showFile ? <FoldVertical /> : <UnfoldVertical />}
      {toggle.showFile ? "Definition only" : "Whole file"}
    </Button>
  );
}

function DefinitionHeader({
  definition,
  peek,
  inPullRequest,
  onGoTo,
  wholeFileToggle,
}: PanelBodyProps & { definition: DefinitionWithCode; wholeFileToggle: WholeFileToggle }) {
  const scopeLabel = SCOPE_LABELS[definition.scope];
  const inThisPullRequest = definition.scope !== "external" && inPullRequest(definition.path);
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-muted px-3 py-2">
      <PathLabel path={definition.path} line={definition.line} className="min-w-40 flex-1" />
      {scopeLabel && <Badge variant="outline">{scopeLabel}</Badge>}
      <Badge variant="secondary">{definition.kind}</Badge>
      {wholeFileToggle && <WholeFileButton toggle={wholeFileToggle} />}
      {inThisPullRequest && (
        <Button
          variant="ghost"
          size="xs"
          className="text-primary"
          onClick={() =>
            onGoTo({ path: definition.path, line: definition.line, name: peek.position.name })
          }
        >
          In this PR <ArrowRight />
        </Button>
      )}
    </div>
  );
}

function WholeFile({
  definition,
  loadFile,
  onIdentifier,
}: Pick<PanelBodyProps, "onIdentifier" | "loadFile"> & { definition: DefinitionWithCode }) {
  const { load, request } = useFileLines(loadFile, definition.path);
  useEffect(request, [request]);
  if (load.failed) return <Callout tone="error">Could not load the file.</Callout>;
  if (!load.lines) return <LoadingRows />;
  return (
    <>
      <CodeRows
        path={definition.path}
        startLine={1}
        tokens={load.lines.tokens}
        focus={{ from: definition.line, to: definition.endLine }}
        onIdentifier={onIdentifier}
      />
      {load.lines.truncated && (
        <p className="px-3 pb-2 text-sm text-muted-foreground">The file is cut at 300 KB.</p>
      )}
    </>
  );
}

function DefinitionBlock(props: PanelBodyProps & { definition: DefinitionWithCode }) {
  const { definition } = props;
  const [showFile, setShowFile] = useState(false);
  const external = definition.scope === "external";
  const wholeFileToggle = external ? null : { showFile, onToggle: () => setShowFile(!showFile) };
  return (
    <section className="flex flex-col overflow-clip rounded-lg border">
      <DefinitionHeader {...props} wholeFileToggle={wholeFileToggle} />
      {external ? (
        <Markdown text={definition.hover ?? definition.signature} className="px-3 py-2 text-sm" />
      ) : showFile ? (
        <WholeFile {...props} />
      ) : (
        <CodeRows
          path={definition.path}
          startLine={definition.line}
          tokens={definition.tokens}
          focus={null}
          onIdentifier={props.onIdentifier}
        />
      )}
    </section>
  );
}

function Definitions(props: PanelBodyProps) {
  const { definitions } = props.peek;
  if (!definitions) return <LoadingRows />;
  if (definitions.length === 0)
    return <EmptyState emoji="🔭">No definition found in this repo.</EmptyState>;
  return (
    <div className="flex flex-col gap-4">
      {definitions.map((definition) => (
        <DefinitionBlock
          key={`${definition.path}:${definition.line}`}
          definition={definition}
          {...props}
        />
      ))}
    </div>
  );
}

function ReferenceFile({
  group,
  name,
  onGoTo,
}: {
  group: ReferenceGroup;
  name: string;
  onGoTo: PanelBodyProps["onGoTo"];
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-background py-1.5">
        <PathLabel path={group.path} className="flex-1" />
        {group.inPullRequest && <Badge>in this PR</Badge>}
        <Badge variant="secondary">{group.references.length}</Badge>
      </div>
      <ul className="flex flex-col gap-0.5">
        {group.references.map((reference) => (
          <PaneRow
            key={reference.line}
            className={group.inPullRequest ? undefined : "hover:bg-transparent"}
          >
            <button
              disabled={!group.inPullRequest}
              onClick={() => onGoTo({ path: reference.path, line: reference.line, name })}
              className="flex w-full gap-3 text-left font-mono text-code disabled:cursor-default disabled:opacity-60"
            >
              <span className="w-8 shrink-0 text-right text-muted-foreground/70 select-none">
                {reference.line}
              </span>
              <code className={WRAPPED_CODE}>
                <CodeTokens tokens={reference.tokens} />
              </code>
            </button>
          </PaneRow>
        ))}
      </ul>
    </section>
  );
}

function References({ peek, inPullRequest, onGoTo }: PanelBodyProps) {
  if (!peek.references) return <LoadingRows />;
  if (peek.references.length === 0)
    return <EmptyState emoji="🍃">No references found. A lonely symbol.</EmptyState>;
  return (
    <div className="flex flex-col gap-4">
      {groupReferencesByFile(peek.references, inPullRequest).map((group) => (
        <ReferenceFile key={group.path} group={group} name={peek.position.name} onGoTo={onGoTo} />
      ))}
    </div>
  );
}

function TabLabel({ label, count, shortcut }: { label: string; count?: number; shortcut: string }) {
  return (
    <>
      {label}
      {count !== undefined && <Badge variant="secondary">{count}</Badge>}
      <Kbd>{shortcut}</Kbd>
    </>
  );
}

function PinButton({ pinned, onTogglePin }: Pick<PeekPanelProps, "pinned" | "onTogglePin">) {
  return (
    <HintButton
      variant="ghost"
      size="icon-sm"
      hint={pinned ? "Unpin from Context" : "Pin to Context"}
      shortcut="m"
      aria-label={pinned ? "Unpin" : "Pin"}
      aria-pressed={pinned}
      onClick={onTogglePin}
      className={pinned ? "text-primary" : undefined}
    >
      {pinned ? <PinOff /> : <Pin />}
    </HintButton>
  );
}

export function PeekPanel({ onTab, onClose, pinned, onTogglePin, ...body }: PeekPanelProps) {
  const { peek } = body;
  return (
    <section
      aria-label={peek.position.name}
      className="flex min-h-0 flex-1 animate-step-enter flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <Telescope className="size-4 text-primary" />
        <h2 className="min-w-0 flex-1 font-mono text-sm font-bold wrap-anywhere">
          {peek.position.name}
        </h2>
        {peek.definitions?.length ? <PinButton pinned={pinned} onTogglePin={onTogglePin} /> : null}
        <HintButton
          variant="ghost"
          size="icon-sm"
          hint="Close"
          shortcut="Esc"
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </HintButton>
      </div>
      <Tabs
        value={peek.tab}
        onValueChange={(tab) => onTab(tab as PeekState["tab"])}
        className="min-h-0 flex-1"
      >
        <TabsList className="w-full">
          <TabsTrigger value="definitions">
            <TabLabel label="Definition" count={peek.definitions?.length} shortcut="gd" />
          </TabsTrigger>
          <TabsTrigger value="references">
            <TabLabel label="References" count={peek.references?.length} shortcut="gr" />
          </TabsTrigger>
        </TabsList>
        {peek.error && <Callout tone="error">{peek.error}</Callout>}
        <TabsContent value="definitions" className="min-h-0 overflow-y-auto">
          <Definitions {...body} />
        </TabsContent>
        <TabsContent value="references" className="min-h-0 overflow-y-auto">
          <References {...body} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
