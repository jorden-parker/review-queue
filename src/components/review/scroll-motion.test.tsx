import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrollOptionsFor, scrollToElement } from "./scroll-motion";

describe("scrollOptionsFor", () => {
  it("lands on a new step instantly instead of sweeping across it", () => {
    expect(scrollOptionsFor("step")).toEqual({ behavior: "instant", block: "start" });
  });

  it("lands on a jumped-to line instantly with context around it", () => {
    expect(scrollOptionsFor("line")).toEqual({ behavior: "instant", block: "center" });
  });

  it("glides between hunks only as far as needed", () => {
    expect(scrollOptionsFor("hunk")).toEqual({ behavior: "smooth", block: "nearest" });
  });
});

type FakeRow = { element: HTMLElement; scrolls: () => number; moveTo: (top: number) => void };

function addRow(id: string): FakeRow {
  const element = document.createElement("div");
  element.id = id;
  let top = 0;
  element.getBoundingClientRect = () => new DOMRect(0, top, 100, 20);
  const scroll = vi.fn();
  element.scrollIntoView = scroll;
  document.body.append(element);
  return { element, scrolls: () => scroll.mock.calls.length, moveTo: (next) => (top = next) };
}

function nextFrames(count = 1) {
  vi.advanceTimersByTime(16 * count);
}

describe("scrollToElement", () => {
  let stop: () => void = () => {};

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("keeps a jumped-to line in place while content above it loads", () => {
    const row = addRow("target");
    stop = scrollToElement("target", "line");
    expect(row.scrolls()).toBe(1);
    row.moveTo(400);
    nextFrames();
    expect(row.scrolls()).toBe(2);
  });

  it("scrolls to a line that only renders after the jump", () => {
    stop = scrollToElement("late", "line");
    const row = addRow("late");
    nextFrames();
    expect(row.scrolls()).toBe(1);
  });

  it("lets the reader take over as soon as they scroll", () => {
    const row = addRow("target");
    stop = scrollToElement("target", "line");
    window.dispatchEvent(new WheelEvent("wheel"));
    row.moveTo(400);
    nextFrames();
    expect(row.scrolls()).toBe(1);
  });

  it("stops following once the page has settled", () => {
    const row = addRow("target");
    stop = scrollToElement("target", "line");
    nextFrames(200);
    row.moveTo(400);
    nextFrames();
    expect(row.scrolls()).toBe(1);
  });

  it("drops the previous target when a new jump starts", () => {
    const first = addRow("first");
    addRow("second");
    scrollToElement("first", "line");
    stop = scrollToElement("second", "line");
    first.moveTo(400);
    nextFrames();
    expect(first.scrolls()).toBe(1);
  });
});
