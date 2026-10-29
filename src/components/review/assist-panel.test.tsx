import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AssistThread, AssistTurn } from "@/lib/assist-protocol";
import { AssistPanel } from "./assist-panel";
import { NOTE_KIND_STYLES } from "./note-kinds";
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
    retry: vi.fn(),
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
      citationsOf={() => []}
      onSaveNote={vi.fn()}
      onShowLines={vi.fn()}
      onShowCitation={vi.fn()}
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

describe("AssistPanel reviewer turns", () => {
  it("renders the reviewer's Markdown, keeping its line breaks as paragraphs", () => {
    const { thread, assist } = chat([
      { role: "reviewer", text: "Is **this** safe?\n\nSee `load`." },
    ]);
    render(panel({ thread, assist }));
    expect(screen.getByText("this").tagName).toBe("STRONG");
    expect(screen.getByText("load").tagName).toBe("CODE");
  });

  it("says when a model answer was cut off", () => {
    const { thread, assist } = chat([
      { role: "reviewer", text: "Explain this file" },
      { role: "model", text: "Half an", ended: "failed" },
    ]);
    render(panel({ thread, assist }));
    expect(screen.getByText("The answer was cut off.")).toBeTruthy();
  });
});

describe("AssistPanel lookups", () => {
  it("lists the lookups a model turn made, with each label's code shown", () => {
    const lookup = {
      tool: "find_references",
      label: "Callers and uses of `loadReview` (2)",
      paths: ["src/app.ts"],
    };
    const { thread, assist } = chat([
      QUESTION,
      { role: "model", text: "Two callers.", lookups: [lookup] },
    ]);
    render(panel({ thread, assist }));
    const list = screen.getByRole("list", { name: "Lookups" });
    expect(within(list).getByText("loadReview").tagName).toBe("CODE");
  });

  it("keeps a lookup label as one run of text so its file path flows after the verb", () => {
    const lookup = { tool: "read_file", label: "Read `src/a.ts` L1–L9", paths: ["src/a.ts"] };
    const { thread, assist } = chat([
      QUESTION,
      { role: "model", text: "Read it.", lookups: [lookup] },
    ]);
    render(panel({ thread, assist }));
    const list = screen.getByRole("list", { name: "Lookups" });
    const label = within(list).getByText("src/a.ts").parentElement;
    expect(label?.tagName).toBe("SPAN");
    expect(label?.textContent).toBe("Read src/a.ts L1–L9");
  });
});

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

describe("AssistPanel comment draft", () => {
  it("opens on the label the model wrote and leaves that label out of the text", () => {
    const thread: AssistThread = {
      ...BASE_THREAD,
      action: "comment",
      turns: [{ role: "model", text: "suggestion: use `map`" }],
    };
    render(panel({ thread, assist: fakeAssist(thread) }));

    expect(screen.getByRole("button", { name: "Suggestion" }).className).toContain(
      NOTE_KIND_STYLES.suggestion,
    );
    expect(screen.getByRole("button", { name: "Question" }).className).not.toContain(
      NOTE_KIND_STYLES.question,
    );
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Comment draft" });
    expect(textarea.value).toBe("use `map`");
  });

  it("reads the label from a draft the model wrapped in backticks", () => {
    const thread: AssistThread = {
      ...BASE_THREAD,
      action: "comment",
      turns: [{ role: "model", text: "`suggestion: use `map``" }],
    };
    render(panel({ thread, assist: fakeAssist(thread) }));

    expect(screen.getByRole("button", { name: "Suggestion" }).className).toContain(
      NOTE_KIND_STYLES.suggestion,
    );
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Comment draft" });
    expect(textarea.value).toBe("use `map`");
  });
});

describe("AssistPanel retry", () => {
  it("offers Retry instead of the long-thread message after a failed reply", () => {
    const thread: AssistThread = { ...BASE_THREAD, turns: [QUESTION] };
    const assist = fakeAssist(thread, { error: "LLM request failed (HTTP 503)" });
    render(panel({ thread, assist }));

    expect(screen.getByText(/Local model unavailable/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(assist.retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/long thread/)).toBeNull();
  });

  it("offers Retry after a stop that came before any reply", () => {
    const { thread, assist } = chat([QUESTION]);
    render(panel({ thread, assist }));

    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("offers no Retry on a thread asked on an older commit", () => {
    const thread: AssistThread = { ...BASE_THREAD, turns: [QUESTION] };
    render(panel({ thread, assist: fakeAssist(thread, { readOnly: true }) }));

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByText(/Asked on an older commit/)).toBeTruthy();
  });

  it("keeps the long-thread message once the thread is too long to continue", () => {
    const turns: AssistTurn[] = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? "reviewer" : "model",
      text: `turn ${index}`,
    }));
    const { thread, assist } = chat(turns);
    render(panel({ thread, assist }));

    expect(screen.getByText(/long thread/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
