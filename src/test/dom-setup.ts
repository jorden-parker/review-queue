import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Element.prototype.scrollIntoView = function scrollIntoView() {};

afterEach(() => cleanup());
