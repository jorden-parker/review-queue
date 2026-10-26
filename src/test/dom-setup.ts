import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Element.prototype.scrollIntoView = function scrollIntoView() {};

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => cleanup());
