export type ScrollKind = "step" | "line" | "hunk";

const OPTIONS: Record<ScrollKind, ScrollIntoViewOptions> = {
  step: { behavior: "instant", block: "start" },
  line: { behavior: "instant", block: "center" },
  hunk: { behavior: "smooth", block: "nearest" },
};

const ARRIVAL = "animate-line-arrive";
const SETTLE_MS = 2000;
const READER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

let stopFollowing: () => void = () => {};

export function scrollOptionsFor(kind: ScrollKind): ScrollIntoViewOptions {
  return OPTIONS[kind];
}

function replayArrival(element: HTMLElement): void {
  element.classList.remove(ARRIVAL);
  void element.offsetWidth;
  element.classList.add(ARRIVAL);
}

function topOf(element: HTMLElement): number {
  return element.getBoundingClientRect().top;
}

function place(element: HTMLElement, kind: ScrollKind, placedTop: number | null): number {
  if (placedTop !== null && topOf(element) === placedTop) return placedTop;
  element.scrollIntoView(scrollOptionsFor(kind));
  if (kind === "line" && placedTop === null) replayArrival(element);
  return topOf(element);
}

function follow(id: string, kind: ScrollKind): () => void {
  const deadline = performance.now() + SETTLE_MS;
  let placedTop: number | null = null;
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    for (const type of READER_INPUT) window.removeEventListener(type, stop, true);
  };
  const tick = () => {
    const element = document.getElementById(id);
    if (element) placedTop = place(element, kind, placedTop);
    if (performance.now() < deadline) frame = requestAnimationFrame(tick);
    else stop();
  };
  for (const type of READER_INPUT) window.addEventListener(type, stop, true);
  tick();
  return stop;
}

export function scrollToElement(id: string, kind: ScrollKind): () => void {
  stopFollowing();
  if (kind === "hunk") {
    document.getElementById(id)?.scrollIntoView(scrollOptionsFor(kind));
    stopFollowing = () => {};
  } else {
    stopFollowing = follow(id, kind);
  }
  return stopFollowing;
}
