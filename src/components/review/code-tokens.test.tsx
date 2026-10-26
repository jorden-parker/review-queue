import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeTokens } from "./code-tokens";

describe("CodeTokens", () => {
  it("links known identifiers in code but not inside literals", () => {
    render(
      <CodeTokens
        tokens={[{ text: "import { format } from " }, { text: '"./format"', literal: true }]}
        linkable={new Set(["format"])}
      />,
    );
    expect(screen.getAllByRole("button", { name: "format" })).toHaveLength(1);
    expect(screen.getByText('"./format"').tagName).toBe("SPAN");
  });
});
