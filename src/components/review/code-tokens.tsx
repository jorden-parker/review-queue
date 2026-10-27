"use client";

import type { CSSProperties } from "react";
import { cn } from "cn";
import type { Token } from "@/lib/highlight";
import type { OccurrenceKind } from "./occurrences";

const IDENTIFIER_SPLIT = /([A-Za-z_$][\w$]*)/;
const IDENTIFIER = /^[A-Za-z_$]/;

export type IdentifierTarget = { name: string; character: number };

type EmphasisKind = "landed" | OccurrenceKind;

type IdentifierHandlers = {
  onIdentifier?: (target: IdentifierTarget) => void;
  onHover?: (target: IdentifierTarget | null) => void;
  emphasis?: string;
  emphasisKind?: EmphasisKind;
};

const EMPHASIS_RINGS: Record<EmphasisKind, string> = {
  landed: "bg-primary/20 ring-1 ring-primary/60",
  definition: "bg-primary/20 ring-1 ring-primary/60",
  reference: "bg-primary/10 ring-1 ring-primary/30",
};

function ignore(): void {}

function IdentifierName({
  name,
  emphasis,
  emphasisKind = "landed",
}: {
  name: string;
  emphasis?: string;
  emphasisKind?: EmphasisKind;
}) {
  return name === emphasis ? (
    <mark
      className={cn(
        "rounded-xs text-inherit transition-colors duration-calm",
        EMPHASIS_RINGS[emphasisKind],
      )}
    >
      {name}
    </mark>
  ) : (
    name
  );
}

function IdentifierButton({
  target,
  onIdentifier,
  onHover = ignore,
  emphasis,
  emphasisKind,
}: { target: IdentifierTarget } & Required<Pick<IdentifierHandlers, "onIdentifier">> &
  IdentifierHandlers) {
  return (
    <button
      onClick={() => onIdentifier(target)}
      onMouseEnter={() => onHover(target)}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer rounded-sm underline decoration-foreground/25 decoration-dotted decoration-1 underline-offset-4 transition-colors duration-calm hover:bg-accent hover:decoration-primary"
    >
      <IdentifierName name={target.name} emphasis={emphasis} emphasisKind={emphasisKind} />
    </button>
  );
}

function identifierParts(text: string, start: number, handlers: IdentifierHandlers) {
  const { onIdentifier, emphasis, emphasisKind } = handlers;
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
        emphasisKind={emphasisKind}
      />
    ) : (
      <IdentifierName key={index} name={part} emphasis={emphasis} emphasisKind={emphasisKind} />
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
