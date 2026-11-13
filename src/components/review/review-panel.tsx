"use client";

import {
  Ellipsis,
  GripVertical,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";
import {
  type DragEvent,
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";
import { HintButton } from "@/components/common/hint-button";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PANE_SHORTCUTS,
  PANE_SIDES,
  PRIMARY_PANES,
  type PaneId,
  type PaneLayout,
  type PanelSide,
} from "./pane-layout";
import { PANEL_WIDTH } from "./panel-width";
import type { usePanelWidth } from "./use-panel-width";

export type PaneEntry = { id: PaneId; label: string; count: number | null };
export type MoreMenu = { entries: PaneEntry[]; open: PaneId[] };
export type PaneContent = { body: ReactNode; ownHeader?: boolean };

export type SideControls = {
  togglePanel: () => void;
  pickPane: (id: PaneId) => void;
  splitPane: (id: PaneId) => void;
  showPane: (id: PaneId) => void;
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
    asideEdge: "",
    stripEdge: "",
    columnEdge: "max-lg:right-full",
    handleSide: "-left-1",
    OpenIcon: PanelRightOpen,
    CloseIcon: PanelRightClose,
  },
  left: {
    label: "Discuss panel",
    toggleName: "chat side",
    shortcut: "[",
    asideEdge: "flex-row-reverse",
    stripEdge: "",
    columnEdge: "max-lg:left-full",
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
      className="size-10"
      onClick={onToggle}
    >
      <Icon />
    </HintButton>
  );
}

function isTabbed(pane: PaneEntry): boolean {
  return PRIMARY_PANES.includes(pane.id);
}

function paneName(pane: PaneEntry): string {
  return pane.count ? `${pane.label} (${pane.count})` : pane.label;
}

function tabIndexAfter(key: string, index: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

function PaneTabs({
  tabs,
  panes,
  side,
  controls,
}: {
  tabs: PaneEntry[];
  panes: PaneLayout;
  side: PanelSide;
  controls: SideControls;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedId = tabs.find((tab) => panes.includes(tab.id))?.id;
  const choose = (id: PaneId, split: boolean) => {
    if (panes.includes(id)) return;
    if (split) controls.splitPane(id);
    else controls.showPane(id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = tabIndexAfter(event.key, index, tabs.length);
    if (target === null) return;
    event.preventDefault();
    buttons.current[target]?.focus();
    choose(tabs[target].id, false);
  };
  return (
    <div
      role="tablist"
      aria-label="Review panes"
      className="flex shrink-0 gap-1 border-b px-3 py-2"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          type="button"
          role="tab"
          id={`${side}-tab-${tab.id}`}
          aria-controls={`${side}-panes`}
          aria-selected={tab.id === selectedId}
          aria-label={paneName(tab)}
          tabIndex={(selectedId === undefined ? index === 0 : tab.id === selectedId) ? 0 : -1}
          draggable
          onDragStart={(event) => startPaneDrag(event, tab.id, side)}
          onClick={(event) => choose(tab.id, event.shiftKey)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className="flex min-h-10 min-w-0 flex-1 cursor-grab items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-calm ease-calm hover:bg-foreground/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
        >
          {tab.label}
          {tab.count ? (
            <span aria-hidden className="text-xs tabular-nums opacity-70">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function MorePanes({ menu, controls }: { menu: MoreMenu; controls: SideControls }) {
  const [open, setOpen] = useState(false);
  const choose = (id: PaneId, split: boolean) => {
    setOpen(false);
    if (split) controls.splitPane(id);
    else controls.pickPane(id);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="More panes"
          className="size-10 text-muted-foreground hover:text-foreground"
        >
          <Ellipsis />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" aria-label="More panes" className="w-56 gap-1 p-1">
        <ul className="flex flex-col">
          {menu.entries.map((pane) => {
            const isOpen = menu.open.includes(pane.id);
            const shortcut = PANE_SHORTCUTS[pane.id];
            return (
              <li key={pane.id}>
                <button
                  type="button"
                  aria-label={paneName(pane)}
                  aria-pressed={isOpen}
                  draggable
                  onDragStart={(event) => startPaneDrag(event, pane.id, PANE_SIDES[pane.id])}
                  onClick={(event) => choose(pane.id, event.shiftKey)}
                  className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm text-foreground transition-colors duration-calm ease-calm hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-accent aria-pressed:font-medium"
                >
                  <span>{pane.label}</span>
                  {shortcut && <Kbd aria-hidden>{shortcut}</Kbd>}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
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
        className="group/pane-header flex min-h-11 shrink-0 cursor-grab items-center gap-2 px-5 pt-3 text-sm font-medium text-muted-foreground active:cursor-grabbing"
      >
        <span className="flex-1 wrap-anywhere">{pane.label}</span>
        <GripVertical
          aria-hidden
          className="size-3.5 opacity-0 transition-opacity duration-calm group-hover/pane-header:opacity-60"
        />
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
      <div className="flex min-h-0 flex-1 animate-step-enter flex-col overflow-y-auto px-5 pt-2 pb-5 [scrollbar-gutter:stable]">
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
      className={`group/resize absolute inset-y-0 ${handleSide} z-10 flex w-2 cursor-col-resize touch-none justify-center`}
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
  more,
}: {
  side: PanelSide;
  entries: PaneEntry[];
  panes: PaneLayout;
  controls: SideControls;
  sizing: PanelSizing;
  renderPane: (id: PaneId) => PaneContent;
  more?: MoreMenu;
}) {
  const style = SIDE_STYLES[side];
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const { width, dragging, contentRef } = sizing;
  const entryOf = (id: PaneId) => entries.find((entry) => entry.id === id);
  const tabs = entries.filter(isTabbed);
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
        className={`flex w-panel-strip-compact shrink-0 flex-col items-center gap-3 overflow-y-auto ${style.stripEdge} bg-rail py-3`}
      >
        <PanelToggle side={side} open={panes.length > 0} onToggle={controls.togglePanel} />
        {more && (
          <MorePanes
            menu={{
              entries: more.entries.filter((entry) => !(panes.length > 0 && isTabbed(entry))),
              open: more.open,
            }}
            controls={controls}
          />
        )}
      </div>
      {(panes.length > 0 || dropIndex !== null) && (
        <div
          ref={contentRef}
          id={`${side}-panes`}
          data-testid="pane-column"
          style={{ width }}
          className={`relative flex min-h-0 max-w-panel-overlay flex-col bg-card max-lg:absolute max-lg:inset-y-0 max-lg:z-30 max-lg:shadow-lg ${style.columnEdge} ${dragging ? "" : "transition-[width] duration-calm ease-calm"}`}
        >
          <PanelResizeHandle sizing={sizing} handleSide={style.handleSide} />
          {tabs.length > 0 && (
            <PaneTabs tabs={tabs} panes={panes} side={side} controls={controls} />
          )}
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
