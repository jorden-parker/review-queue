"use client";

import type { CSSProperties } from "react";
import type { Token } from "@/lib/highlight";

const IDENTIFIER_SPLIT = /([A-Za-z_$][\w$]*)/;
const NO_LINKS = new Set<string>();

type IdentifierHandlers = {
  linkable: Set<string>;
  onIdentifier: (name: string) => void;
  onHover: (name: string | null) => void;
};

function TokenText({
  token,
  linkable,
  onIdentifier,
  onHover,
}: { token: Token } & IdentifierHandlers) {
  const style = { "--light": token.light, "--dark": token.dark } as CSSProperties;
  if (token.literal) {
    return (
      <span className="code-token" style={style}>
        {token.text}
      </span>
    );
  }
  const parts = token.text.split(IDENTIFIER_SPLIT);
  return (
    <span className="code-token" style={style}>
      {parts.map((part, index) =>
        linkable.has(part) ? (
          <button
            key={index}
            onClick={() => onIdentifier(part)}
            onMouseEnter={() => onHover(part)}
            onMouseLeave={() => onHover(null)}
            className="cursor-pointer rounded-sm underline decoration-dotted decoration-1 underline-offset-4 transition-colors duration-150 hover:bg-accent"
          >
            {part}
          </button>
        ) : (
          part
        ),
      )}
    </span>
  );
}

function ignore(): void {}

export function CodeTokens({
  tokens,
  linkable = NO_LINKS,
  onIdentifier = ignore,
  onHover = ignore,
}: { tokens: Token[] } & Partial<IdentifierHandlers>) {
  return tokens.map((token, index) => (
    <TokenText
      key={index}
      token={token}
      linkable={linkable}
      onIdentifier={onIdentifier}
      onHover={onHover}
    />
  ));
}
