import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Element.prototype.scrollIntoView = function scrollIntoView() {};

Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return new DOMRect(0, 0, 0, 0);
};

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => cleanup());
