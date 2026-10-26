"use client";

import { ArrowRight, Telescope, X } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { HintButton } from "@/components/common/hint-button";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DefinitionWithCode } from "@/lib/review/peek-code";
import { CodeTokens } from "./code-tokens";
import type { LineTarget } from "./locate";
import { groupReferencesByFile, type ReferenceGroup } from "./reference-groups";
import type { PeekState } from "./use-peek";

type PeekPanelProps = {
  peek: PeekState;
  linkable: Set<string>;
  inPullRequest: (path: string) => boolean;
  onIdentifier: (name: string, path: string, line: number) => void;
  onGoTo: (target: LineTarget) => void;
  onTab: (tab: PeekState["tab"]) => void;
  onClose: () => void;
};

type PanelBodyProps = Omit<PeekPanelProps, "onTab" | "onClose">;

function LoadingRows() {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-16 w-full" />
      ))}
    </div>
  );
}

function DefinitionCard({
  definition,
  linkable,
  inPullRequest,
  onIdentifier,
  onGoTo,
}: PanelBodyProps & { definition: DefinitionWithCode }) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <PathLabel path={definition.path} line={definition.line} className="flex-1" />
        <Badge variant="secondary">{definition.kind}</Badge>
        {inPullRequest(definition.path) && (
          <Button
            variant="ghost"
            size="xs"
            className="text-primary"
            onClick={() => onGoTo({ path: definition.path, line: definition.line })}
          >
            In this PR <ArrowRight />
          </Button>
        )}
      </div>
      <pre className="scrollbar-hidden overflow-x-auto py-2 font-mono text-code">
        {definition.tokens.map((row, index) => (
          <div key={index} className="flex px-3 transition-colors duration-150 hover:bg-muted/60">
            <span className="w-8 shrink-0 pr-3 text-right text-muted-foreground/70 select-none">
              {definition.line + index}
            </span>
            <code className="whitespace-pre">
              <CodeTokens
                tokens={row}
                linkable={linkable}
                onIdentifier={(name) =>
                  onIdentifier(name, definition.path, definition.line + index)
                }
              />
            </code>
          </div>
        ))}
      </pre>
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
  onGoTo,
}: {
  group: ReferenceGroup;
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
              onClick={() => onGoTo({ path: reference.path, line: reference.line })}
              className="flex w-full gap-3 rounded-md px-2 py-1 text-left font-mono text-code transition-colors duration-150 hover:bg-muted disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
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
        <ReferenceFile key={group.path} group={group} onGoTo={onGoTo} />
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

export function PeekPanel({ onTab, onClose, ...body }: PeekPanelProps) {
  const { peek } = body;
  return (
    <aside
      aria-label={peek.name}
      className="absolute inset-y-0 right-0 z-20 flex w-peek max-w-full animate-peek-enter flex-col gap-3 border-l bg-background p-4 shadow-2xl"
    >
      <div className="flex items-center gap-2">
        <Telescope size={16} className="text-primary" />
        <h2 className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">{peek.name}</h2>
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
        <TabsContent value="definitions" className="scrollbar-hidden min-h-0 overflow-y-auto">
          <Definitions {...body} />
        </TabsContent>
        <TabsContent value="references" className="scrollbar-hidden min-h-0 overflow-y-auto">
          <References {...body} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
