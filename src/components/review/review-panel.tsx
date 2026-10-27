"use client";

import {
  GripVertical,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";
import { type DragEvent, Fragment, type MouseEvent, type ReactNode, useState } from "react";
import { HintButton } from "@/components/common/hint-button";
import { Button } from "@/components/ui/button";
import type { PaneId, PaneLayout, PanelSide } from "./pane-layout";
import { PANEL_WIDTH } from "./panel-width";
import type { usePanelWidth } from "./use-panel-width";

export type PaneEntry = { id: PaneId; label: string; icon: LucideIcon; count: number | null };
export type PaneContent = { body: ReactNode; ownHeader?: boolean };

export type SideControls = {
  togglePanel: () => void;
  pickPane: (id: PaneId) => void;
  splitPane: (id: PaneId) => void;
  closePane: (id: PaneId) => void;
  dropPane: (id: PaneId, index: number) => void;
};

type PanelSizing = ReturnType<typeof usePanelWidth>;

type SideStyle = {
  label: string;
  toggleName: string;
  shortcut: string;
  asideEdge: string;
  stripEdge: string;
  columnEdge: string;
  handleSide: string;
  OpenIcon: LucideIcon;
  CloseIcon: LucideIcon;
};

const SIDE_STYLES: Record<PanelSide, SideStyle> = {
  right: {
    label: "Review panel",
    toggleName: "panel",
    shortcut: "]",
    asideEdge: "border-l",
    stripEdge: "border-r",
    columnEdge: "max-lg:right-full max-lg:border-l",
    handleSide: "-left-1",
    OpenIcon: PanelRightOpen,
    CloseIcon: PanelRightClose,
  },
  left: {
    label: "Discuss panel",
    toggleName: "chat side",
    shortcut: "[",
    asideEdge: "flex-row-reverse border-r",
    stripEdge: "border-l",
    columnEdge: "max-lg:left-full max-lg:border-r",
    handleSide: "-right-1",
    OpenIcon: PanelLeftOpen,
    CloseIcon: PanelLeftClose,
  },
};

function paneDragType(side: PanelSide): string {
  return `application/x-review-pane-${side}`;
}

function startPaneDrag(event: DragEvent, id: PaneId, side: PanelSide) {
  event.dataTransfer.setData(paneDragType(side), id);
  event.dataTransfer.effectAllowed = "move";
}

function isPaneDrag(event: DragEvent, side: PanelSide): boolean {
  return event.dataTransfer.types.includes(paneDragType(side));
}

function dropIndexAt(event: DragEvent, paneCount: number): number {
  const pane = (event.target as Element).closest<HTMLElement>("[data-pane-index]");
  if (!pane) return paneCount;
  const index = Number(pane.dataset.paneIndex);
  const { top, height } = pane.getBoundingClientRect();
  return event.clientY < top + height / 2 ? index : index + 1;
}

function PanelToggle({
  side,
  open,
  onToggle,
}: {
  side: PanelSide;
  open: boolean;
  onToggle: () => void;
}) {
  const { toggleName, shortcut, OpenIcon, CloseIcon } = SIDE_STYLES[side];
  const label = `${open ? "Hide" : "Show"} ${toggleName}`;
  const Icon = open ? CloseIcon : OpenIcon;
  return (
    <HintButton
      variant="ghost"
      size="icon"
      hint={label}
      shortcut={shortcut}
      aria-label={label}
      onClick={onToggle}
    >
      <Icon />
    </HintButton>
  );
}

function PaneButton({
  pane,
  side,
  open,
  onClick,
}: {
  pane: PaneEntry;
  side: PanelSide;
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
      onDragStart={(event) => startPaneDrag(event, pane.id, side)}
      onClick={onClick}
      className="relative mx-1 h-auto w-auto flex-col gap-1 rounded-lg px-1 py-2 text-xs font-medium text-muted-foreground transition-colors duration-calm ease-calm hover:bg-foreground/5 hover:text-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground"
    >
      <span className="relative flex">
        <Icon />
        {pane.count ? (
          <span className="absolute -top-1.5 left-3 min-w-4 rounded-full bg-marker px-1 text-center text-xs/4 font-bold text-foreground ring-2 ring-rail tabular-nums dark:text-background">
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
  side,
  index,
  content,
  onClose,
}: {
  pane: PaneEntry;
  side: PanelSide;
  index: number;
  content: PaneContent;
  onClose: () => void;
}) {
  const PaneIcon = pane.icon;
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
        onDragStart={(event) => startPaneDrag(event, pane.id, side)}
        className="group/pane-header flex h-11 shrink-0 cursor-grab items-center gap-2 border-b px-4 text-sm font-bold active:cursor-grabbing"
      >
        <PaneIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{pane.label}</span>
        <GripVertical className="size-3.5 opacity-0 transition-opacity duration-calm group-hover/pane-header:opacity-60" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Close ${pane.label}`}
          className="-mr-2 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 animate-step-enter flex-col overflow-y-auto p-4 [scrollbar-gutter:stable]">
        {content.body}
      </div>
    </section>
  );
}

function PanelResizeHandle({ sizing, handleSide }: { sizing: PanelSizing; handleSide: string }) {
  const { width, dragging, maxWidth, handlers } = sizing;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={width}
      aria-valuemin={PANEL_WIDTH.min}
      aria-valuemax={maxWidth}
      tabIndex={0}
      title="Drag to resize. Double-click to fit the content"
      data-dragging={dragging || undefined}
      className={`group/resize absolute inset-y-0 ${handleSide} z-10 flex w-2 cursor-col-resize touch-none justify-center outline-none`}
      {...handlers}
    >
      <span className="h-full w-px bg-transparent transition-colors duration-calm group-hover/resize:bg-primary/60 group-focus-visible/resize:bg-primary group-data-dragging/resize:bg-primary" />
      <span className="absolute top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-border opacity-0 transition-opacity duration-calm group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100 group-data-dragging/resize:bg-primary group-data-dragging/resize:opacity-100" />
    </div>
  );
}

function DropLine() {
  return <div aria-hidden className="h-0.5 shrink-0 bg-primary" />;
}

export function ReviewPanel({
  side,
  entries,
  panes,
  controls,
  sizing,
  renderPane,
}: {
  side: PanelSide;
  entries: PaneEntry[];
  panes: PaneLayout;
  controls: SideControls;
  sizing: PanelSizing;
  renderPane: (id: PaneId) => PaneContent;
}) {
  const style = SIDE_STYLES[side];
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const { width, dragging, contentRef } = sizing;
  const entryOf = (id: PaneId) => entries.find((entry) => entry.id === id);
  const onDragOver = (event: DragEvent) => {
    if (!isPaneDrag(event, side)) return;
    event.preventDefault();
    setDropIndex(dropIndexAt(event, panes.length));
  };
  const onDrop = (event: DragEvent) => {
    const id = event.dataTransfer.getData(paneDragType(side)) as PaneId;
    setDropIndex(null);
    if (id) controls.dropPane(id, dropIndexAt(event, panes.length));
  };
  return (
    <aside
      aria-label={style.label}
      data-side={side}
      className={`relative flex min-h-0 ${style.asideEdge}`}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropIndex(null);
      }}
      onDrop={onDrop}
    >
      <div
        className={`flex w-panel-strip shrink-0 flex-col max-sm:w-panel-strip-compact items-center gap-3 overflow-y-auto ${style.stripEdge} bg-rail py-3`}
      >
        <PanelToggle side={side} open={panes.length > 0} onToggle={controls.togglePanel} />
        <div className="flex w-full flex-col gap-1">
          {entries.map((entry) => (
            <PaneButton
              key={entry.id}
              pane={entry}
              side={side}
              open={panes.includes(entry.id)}
              onClick={(event) =>
                event.shiftKey ? controls.splitPane(entry.id) : controls.pickPane(entry.id)
              }
            />
          ))}
        </div>
      </div>
      {(panes.length > 0 || dropIndex !== null) && (
        <div
          ref={contentRef}
          data-testid="pane-column"
          style={{ width }}
          className={`relative flex min-h-0 max-w-panel-overlay flex-col bg-card max-lg:absolute max-lg:inset-y-0 max-lg:z-30 max-lg:shadow-lg ${style.columnEdge} ${dragging ? "" : "transition-[width] duration-calm ease-calm"}`}
        >
          <PanelResizeHandle sizing={sizing} handleSide={style.handleSide} />
          {panes.map((id, index) => {
            const entry = entryOf(id);
            if (!entry) return null;
            return (
              <Fragment key={id}>
                {dropIndex === index && <DropLine />}
                <PaneFrame
                  pane={entry}
                  side={side}
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
