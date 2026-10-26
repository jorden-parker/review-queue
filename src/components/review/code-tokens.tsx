"use client";

import type { CSSProperties } from "react";
import type { Token } from "@/lib/highlight";

const IDENTIFIER_SPLIT = /([A-Za-z_$][\w$]*)/;
const IDENTIFIER = /^[A-Za-z_$]/;

export type IdentifierTarget = { name: string; character: number };

type IdentifierHandlers = {
  onIdentifier?: (target: IdentifierTarget) => void;
  onHover?: (target: IdentifierTarget | null) => void;
  emphasis?: string;
};

function ignore(): void {}

function IdentifierName({ name, emphasis }: { name: string; emphasis?: string }) {
  return name === emphasis ? (
    <mark className="rounded-sm bg-callout text-callout-foreground">{name}</mark>
  ) : (
    name
  );
}

function IdentifierButton({
  target,
  onIdentifier,
  onHover = ignore,
  emphasis,
}: { target: IdentifierTarget } & Required<Pick<IdentifierHandlers, "onIdentifier">> &
  IdentifierHandlers) {
  return (
    <button
      onClick={() => onIdentifier(target)}
      onMouseEnter={() => onHover(target)}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer rounded-sm underline decoration-dotted decoration-1 underline-offset-4 transition-colors duration-150 hover:bg-accent"
    >
      <IdentifierName name={target.name} emphasis={emphasis} />
    </button>
  );
}

function identifierParts(text: string, start: number, handlers: IdentifierHandlers) {
  const { onIdentifier, emphasis } = handlers;
  let character = start;
  return text.split(IDENTIFIER_SPLIT).map((part, index) => {
    const target = { name: part, character };
    character += part.length;
    if (!IDENTIFIER.test(part)) return part;
    return onIdentifier ? (
      <IdentifierButton
        key={index}
        target={target}
        onIdentifier={onIdentifier}
        onHover={handlers.onHover}
        emphasis={emphasis}
      />
    ) : (
      <IdentifierName key={index} name={part} emphasis={emphasis} />
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
  const plain = token.literal || token.keyword || !(handlers.onIdentifier || handlers.emphasis);
  return (
    <span className="code-token" style={style}>
      {plain ? token.text : identifierParts(token.text, start, handlers)}
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
