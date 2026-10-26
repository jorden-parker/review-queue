"use client";

import { type LucideIcon, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { type DragEvent, Fragment, type MouseEvent, type ReactNode, useState } from "react";
import { HintButton } from "@/components/common/hint-button";
import { Button } from "@/components/ui/button";
import type { PaneId, PaneLayout } from "./pane-layout";

export type PaneEntry = { id: PaneId; label: string; icon: LucideIcon; count: number | null };
export type PaneContent = { body: ReactNode; ownHeader?: boolean };

type PaneControls = {
  panes: PaneLayout;
  togglePanel: () => void;
  pickPane: (id: PaneId) => void;
  splitPane: (id: PaneId) => void;
  closePane: (id: PaneId) => void;
  dropPane: (id: PaneId, index: number) => void;
};

const PANE_DRAG_TYPE = "application/x-review-pane";

function startPaneDrag(event: DragEvent, id: PaneId) {
  event.dataTransfer.setData(PANE_DRAG_TYPE, id);
  event.dataTransfer.effectAllowed = "move";
}

function isPaneDrag(event: DragEvent): boolean {
  return event.dataTransfer.types.includes(PANE_DRAG_TYPE);
}

function dropIndexAt(event: DragEvent, paneCount: number): number {
  const pane = (event.target as Element).closest<HTMLElement>("[data-pane-index]");
  if (!pane) return paneCount;
  const index = Number(pane.dataset.paneIndex);
  const { top, height } = pane.getBoundingClientRect();
  return event.clientY < top + height / 2 ? index : index + 1;
}

function PanelToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const label = open ? "Hide panel" : "Show panel";
  const Icon = open ? PanelRightClose : PanelRightOpen;
  return (
    <HintButton
      variant="ghost"
      size="icon"
      hint={label}
      shortcut="\"
      aria-label={label}
      onClick={onToggle}
    >
      <Icon />
    </HintButton>
  );
}

function PaneButton({
  pane,
  open,
  onClick,
}: {
  pane: PaneEntry;
  open: boolean;
  onClick: (event: MouseEvent) => void;
}) {
  const Icon = pane.icon;
  return (
    <HintButton
      variant="ghost"
      hint="Shift-click or drag to split"
      aria-label={pane.count ? `${pane.label} (${pane.count})` : pane.label}
      aria-pressed={open}
      draggable
      onDragStart={(event) => startPaneDrag(event, pane.id)}
      onClick={onClick}
      className="relative h-auto w-full flex-col gap-1 rounded-none px-1 py-2.5 text-xs text-foreground/60 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:after:absolute aria-pressed:after:inset-y-1 aria-pressed:after:left-0 aria-pressed:after:w-0.5 aria-pressed:after:bg-foreground"
    >
      <span className="relative">
        <Icon />
        {pane.count ? (
          <span className="absolute -top-1.5 left-3 min-w-4 rounded-full bg-primary px-1 text-center text-xs/4 font-semibold text-primary-foreground">
            {pane.count}
          </span>
        ) : null}
      </span>
      <span className="max-sm:sr-only">{pane.label}</span>
    </HintButton>
  );
}

function PaneFrame({
  pane,
  index,
  content,
  onClose,
}: {
  pane: PaneEntry;
  index: number;
  content: PaneContent;
  onClose: () => void;
}) {
  if (content.ownHeader) {
    return (
      <div data-pane-index={index} className="flex min-h-0 flex-1 basis-0 flex-col">
        {content.body}
      </div>
    );
  }
  return (
    <section
      aria-label={pane.label}
      data-pane-index={index}
      className="flex min-h-0 flex-1 basis-0 flex-col border-b last:border-b-0"
    >
      <header
        draggable
        onDragStart={(event) => startPaneDrag(event, pane.id)}
        className="flex shrink-0 cursor-grab items-center justify-between border-b px-3 py-1 text-xs font-medium text-muted-foreground"
      >
        {pane.label}
        <Button variant="ghost" size="icon-xs" aria-label={`Close ${pane.label}`} onClick={onClose}>
          <X />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 animate-step-enter flex-col overflow-y-auto p-3">
        {content.body}
      </div>
    </section>
  );
}

function DropLine() {
  return <div aria-hidden className="h-0.5 shrink-0 bg-primary" />;
}

export function ReviewPanel({
  entries,
  controls,
  renderPane,
}: {
  entries: PaneEntry[];
  controls: PaneControls;
  renderPane: (id: PaneId) => PaneContent;
}) {
  const { panes } = controls;
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const entryOf = (id: PaneId) => entries.find((entry) => entry.id === id);
  const onDragOver = (event: DragEvent) => {
    if (!isPaneDrag(event)) return;
    event.preventDefault();
    setDropIndex(dropIndexAt(event, panes.length));
  };
  const onDrop = (event: DragEvent) => {
    const id = event.dataTransfer.getData(PANE_DRAG_TYPE) as PaneId;
    setDropIndex(null);
    if (id) controls.dropPane(id, dropIndexAt(event, panes.length));
  };
  return (
    <aside
      aria-label="Review panel"
      className="relative flex min-h-0 border-l"
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropIndex(null);
      }}
      onDrop={onDrop}
    >
      <div className="flex w-panel-strip shrink-0 flex-col max-sm:w-panel-strip-compact items-center gap-2 overflow-y-auto border-r bg-muted py-2">
        <PanelToggle open={panes.length > 0} onToggle={controls.togglePanel} />
        <div className="flex w-full flex-col gap-1">
          {entries.map((entry) => (
            <PaneButton
              key={entry.id}
              pane={entry}
              open={panes.includes(entry.id)}
              onClick={(event) =>
                event.shiftKey ? controls.splitPane(entry.id) : controls.pickPane(entry.id)
              }
            />
          ))}
        </div>
      </div>
      {(panes.length > 0 || dropIndex !== null) && (
        <div className="flex min-h-0 w-panel max-w-panel-overlay flex-col bg-card max-lg:absolute max-lg:inset-y-0 max-lg:right-full max-lg:z-30 max-lg:border-l max-lg:shadow-lg">
          {panes.map((id, index) => {
            const entry = entryOf(id);
            if (!entry) return null;
            return (
              <Fragment key={id}>
                {dropIndex === index && <DropLine />}
                <PaneFrame
                  pane={entry}
                  index={index}
                  content={renderPane(id)}
                  onClose={() => controls.closePane(id)}
                />
              </Fragment>
            );
          })}
          {dropIndex === panes.length && <DropLine />}
        </div>
      )}
    </aside>
  );
}
