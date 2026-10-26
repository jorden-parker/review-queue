import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeTokens } from "./code-tokens";

describe("CodeTokens", () => {
  it("links every identifier in code but not keywords or literals", () => {
    render(
      <CodeTokens
        tokens={[
          { text: "import", keyword: true },
          { text: " { format } from " },
          { text: '"./format"', literal: true },
        ]}
        onIdentifier={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "format",
      "from",
    ]);
    expect(screen.getByText('"./format"').tagName).toBe("SPAN");
  });

  it("reports the identifier's UTF-16 column across tokens", () => {
    const onIdentifier = vi.fn();
    render(
      <CodeTokens
        tokens={[{ text: "const", keyword: true }, { text: " ✓x = " }, { text: "load(id)" }]}
        onIdentifier={onIdentifier}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "id" }));
    expect(onIdentifier).toHaveBeenCalledWith({ name: "id", character: 16 });
  });

  it("renders plain text when no handler is given", () => {
    render(<CodeTokens tokens={[{ text: "load(id)" }]} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("marks only identifiers that match the emphasised name", () => {
    const { container } = render(
      <CodeTokens tokens={[{ text: "load(id, idle, id)" }]} onIdentifier={vi.fn()} emphasis="id" />,
    );
    expect([...container.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual([
      "id",
      "id",
    ]);
  });

  it("marks the emphasised name in plain text too", () => {
    const { container } = render(<CodeTokens tokens={[{ text: "load(id)" }]} emphasis="id" />);
    expect(container.querySelector("mark")?.textContent).toBe("id");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
