"use client";

import type { CSSProperties } from "react";
import type { Token } from "@/lib/highlight";

const IDENTIFIER_SPLIT = /([A-Za-z_$][\w$]*)/;
const IDENTIFIER = /^[A-Za-z_$]/;

export type IdentifierTarget = { name: string; character: number };

type IdentifierHandlers = {
  onIdentifier?: (target: IdentifierTarget) => void;
  onHover?: (target: IdentifierTarget | null) => void;
};

function ignore(): void {}

function IdentifierButton({
  target,
  onIdentifier,
  onHover = ignore,
}: { target: IdentifierTarget } & Required<Pick<IdentifierHandlers, "onIdentifier">> &
  IdentifierHandlers) {
  return (
    <button
      onClick={() => onIdentifier(target)}
      onMouseEnter={() => onHover(target)}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer rounded-sm underline decoration-dotted decoration-1 underline-offset-4 transition-colors duration-150 hover:bg-accent"
    >
      {target.name}
    </button>
  );
}

function linkedParts(text: string, start: number, handlers: IdentifierHandlers) {
  const { onIdentifier } = handlers;
  let character = start;
  return text.split(IDENTIFIER_SPLIT).map((part, index) => {
    const target = { name: part, character };
    character += part.length;
    return onIdentifier && IDENTIFIER.test(part) ? (
      <IdentifierButton
        key={index}
        target={target}
        onIdentifier={onIdentifier}
        onHover={handlers.onHover}
      />
    ) : (
      part
    );
  });
}

function TokenText({
  token,
  start,
  handlers,
}: {
  token: Token;
  start: number;
  handlers: IdentifierHandlers;
}) {
  const style = { "--light": token.light, "--dark": token.dark } as CSSProperties;
  const plain = token.literal || token.keyword || !handlers.onIdentifier;
  return (
    <span className="code-token" style={style}>
      {plain ? token.text : linkedParts(token.text, start, handlers)}
    </span>
  );
}

function tokenStarts(tokens: Token[]): number[] {
  const starts: number[] = [];
  let character = 0;
  for (const token of tokens) {
    starts.push(character);
    character += token.text.length;
  }
  return starts;
}

export function CodeTokens({ tokens, ...handlers }: { tokens: Token[] } & IdentifierHandlers) {
  const starts = tokenStarts(tokens);
  return tokens.map((token, index) => (
    <TokenText key={index} token={token} start={starts[index]} handlers={handlers} />
  ));
}
