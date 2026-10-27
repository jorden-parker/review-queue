import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AssistThread, AssistTurn } from "@/lib/assist-protocol";
import { AssistPanel } from "./assist-panel";
import type { Assist } from "./use-assist";

const BASE_THREAD: AssistThread = {
  id: "t1",
  headSha: "a".repeat(40),
  target: { kind: "file", path: "src/a.ts" },
  action: "explain",
  question: null,
  turns: [],
};

function fakeAssist(thread: AssistThread, overrides: Partial<Assist> = {}): Assist {
  return {
    thread,
    streaming: false,
    error: null,
    readOnly: false,
    open: vi.fn(),
    reopen: vi.fn(),
    send: vi.fn(),
    stop: vi.fn(),
    close: vi.fn(),
    ...overrides,
  };
}

function chat(turns: AssistTurn[], streaming = false) {
  const thread: AssistThread = { ...BASE_THREAD, turns };
  return { thread, assist: fakeAssist(thread, { streaming }) };
}

function panel({ thread, assist }: { thread: AssistThread; assist: Assist }) {
  return (
    <AssistPanel
      assist={assist}
      thread={thread}
      label="src/a.ts"
      commentLine={null}
      onSaveNote={vi.fn()}
      onShowLines={vi.fn()}
    />
  );
}

type Layout = { scrollHeight: number; clientHeight: number };

function fakeLayout(element: HTMLElement, layout: Layout) {
  let scrollTop = 0;
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    get: () => layout.clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => layout.scrollHeight,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  return layout;
}

function readerScrollsUp(list: HTMLElement) {
  list.scrollTop = 100;
  fireEvent.scroll(list);
}

const QUESTION: AssistTurn = { role: "reviewer", text: "Explain this" };

describe("AssistPanel scrolling", () => {
  it("follows a streaming answer", () => {
    const first = chat([QUESTION, { role: "model", text: "Part" }], true);
    const { rerender } = render(panel(first));
    const list = screen.getByTestId("chat-messages");
    fakeLayout(list, { scrollHeight: 1000, clientHeight: 200 });

    rerender(panel(chat([QUESTION, { role: "model", text: "Part one" }], true)));

    expect(list.scrollTop).toBe(1000);
  });

  it("stops following after the reader scrolls up", () => {
    const { rerender } = render(panel(chat([QUESTION, { role: "model", text: "Part" }], true)));
    const list = screen.getByTestId("chat-messages");
    const layout = fakeLayout(list, { scrollHeight: 1000, clientHeight: 200 });

    readerScrollsUp(list);
    layout.scrollHeight = 1200;
    rerender(panel(chat([QUESTION, { role: "model", text: "Part one" }], true)));

    expect(list.scrollTop).toBe(100);
  });

  it("follows again once the reader is back at the bottom", () => {
    const { rerender } = render(panel(chat([QUESTION, { role: "model", text: "Part" }], true)));
    const list = screen.getByTestId("chat-messages");
    const layout = fakeLayout(list, { scrollHeight: 1000, clientHeight: 200 });

    readerScrollsUp(list);
    layout.scrollHeight = 1200;
    list.scrollTop = 1000;
    fireEvent.scroll(list);
    layout.scrollHeight = 1400;
    rerender(panel(chat([QUESTION, { role: "model", text: "Part one" }], true)));

    expect(list.scrollTop).toBe(1400);
  });

  it("sending a follow-up follows the reply", () => {
    const answered = chat([QUESTION, { role: "model", text: "An answer" }]);
    const { rerender } = render(panel(answered));
    const list = screen.getByTestId("chat-messages");
    const layout = fakeLayout(list, { scrollHeight: 1000, clientHeight: 200 });

    readerScrollsUp(list);
    const composer = screen.getByLabelText("Ask the model", { selector: "textarea" });
    fireEvent.change(composer, { target: { value: "Why?" } });
    fireEvent.keyDown(composer, { key: "Enter", metaKey: true });
    expect(answered.assist.send).toHaveBeenCalledWith("Why?");

    layout.scrollHeight = 1200;
    rerender(
      panel(
        chat(
          [
            QUESTION,
            { role: "model", text: "An answer" },
            { role: "reviewer", text: "Why?" },
            { role: "model", text: "Because" },
          ],
          true,
        ),
      ),
    );

    expect(list.scrollTop).toBe(layout.scrollHeight);
  });

  it("opening a saved chat starts at the top", () => {
    const saved = chat([QUESTION, { role: "model", text: "An answer" }]);
    const { rerender } = render(panel(saved));
    const list = screen.getByTestId("chat-messages");
    fakeLayout(list, { scrollHeight: 1000, clientHeight: 200 });

    rerender(panel(saved));

    expect(list.scrollTop).toBe(0);
  });
});
