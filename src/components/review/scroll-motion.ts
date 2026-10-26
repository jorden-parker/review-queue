export type ScrollKind = "step" | "line" | "hunk";

const OPTIONS: Record<ScrollKind, ScrollIntoViewOptions> = {
  step: { behavior: "instant", block: "start" },
  line: { behavior: "instant", block: "center" },
  hunk: { behavior: "smooth", block: "nearest" },
};

const ARRIVAL = "animate-line-arrive";

export function scrollOptionsFor(kind: ScrollKind): ScrollIntoViewOptions {
  return OPTIONS[kind];
}

function replayArrival(element: HTMLElement): void {
  element.classList.remove(ARRIVAL);
  void element.offsetWidth;
  element.classList.add(ARRIVAL);
}

export function scrollToElement(id: string, kind: ScrollKind): void {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView(scrollOptionsFor(kind));
  if (kind === "line") replayArrival(element);
}
