"use client";

import { ArrowRight, Pin, PinOff, Telescope, X } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { HintButton } from "@/components/common/hint-button";
import { Markdown } from "@/components/common/markdown-text";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DefinitionWithCode } from "@/lib/review/peek-code";
import type { SymbolPosition } from "@/lib/types";
import { CodeTokens } from "./code-tokens";
import type { LineTarget } from "./locate";
import { groupReferencesByFile, type ReferenceGroup } from "./reference-groups";
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

function DefinitionHeader({
  definition,
  peek,
  inPullRequest,
  onGoTo,
}: PanelBodyProps & { definition: DefinitionWithCode }) {
  const scopeLabel = SCOPE_LABELS[definition.scope];
  const inThisPullRequest = definition.scope !== "external" && inPullRequest(definition.path);
  return (
    <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
      <PathLabel path={definition.path} line={definition.line} className="flex-1" />
      {scopeLabel && <Badge variant="outline">{scopeLabel}</Badge>}
      <Badge variant="secondary">{definition.kind}</Badge>
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

function DefinitionCode({
  definition,
  onIdentifier,
}: Pick<PanelBodyProps, "onIdentifier"> & { definition: DefinitionWithCode }) {
  return (
    <pre className="overflow-x-auto py-2 font-mono text-code">
      <div className="w-max min-w-full">
        {definition.tokens.map((row, index) => (
          <div key={index} className="flex px-3 transition-colors duration-calm hover:bg-muted/60">
            <span className="w-8 shrink-0 pr-3 text-right text-muted-foreground/70 select-none">
              {definition.line + index}
            </span>
            <code className="whitespace-pre">
              <CodeTokens
                tokens={row}
                onIdentifier={(target) =>
                  onIdentifier({
                    ...target,
                    path: definition.path,
                    line: definition.line + index,
                    side: "new",
                  })
                }
              />
            </code>
          </div>
        ))}
      </div>
    </pre>
  );
}

function DefinitionCard(props: PanelBodyProps & { definition: DefinitionWithCode }) {
  const { definition } = props;
  return (
    <Card className="gap-0 py-0">
      <DefinitionHeader {...props} />
      {definition.scope === "external" ? (
        <Markdown text={definition.hover ?? definition.signature} className="px-3 py-2 text-sm" />
      ) : (
        <DefinitionCode definition={definition} onIdentifier={props.onIdentifier} />
      )}
    </Card>
  );
}

function Definitions(props: PanelBodyProps) {
  const { definitions } = props.peek;
  if (!definitions) return <LoadingRows />;
  if (definitions.length === 0)
    return <EmptyState emoji="🔭">No definition found in this repo.</EmptyState>;
  return (
    <div className="flex flex-col gap-3">
      {definitions.map((definition) => (
        <DefinitionCard
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
    <section className="flex flex-col gap-0.5">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-background py-1.5">
        <PathLabel path={group.path} className="flex-1" />
        {group.inPullRequest && <Badge>in this PR</Badge>}
        <Badge variant="secondary">{group.references.length}</Badge>
      </div>
      <ul className="flex flex-col">
        {group.references.map((reference) => (
          <li key={reference.line}>
            <button
              disabled={!group.inPullRequest}
              onClick={() => onGoTo({ path: reference.path, line: reference.line, name })}
              className="flex w-full gap-3 rounded-md px-2 py-1 text-left font-mono text-code transition-colors duration-calm hover:bg-muted disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
            >
              <span className="w-8 shrink-0 text-right text-muted-foreground/70 select-none">
                {reference.line}
              </span>
              <code className="truncate whitespace-pre">
                <CodeTokens tokens={reference.tokens} />
              </code>
            </button>
          </li>
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
      className="flex min-h-0 flex-1 animate-step-enter flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <Telescope size={16} className="text-primary" />
        <h2 className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">
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
        {peek.error && (
          <p className="rounded-lg bg-del px-3 py-2 text-sm text-del-foreground">{peek.error}</p>
        )}
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
