"use client";

import { ArrowRight, X } from "lucide-react";
import type { LineTarget } from "./locate";
import type { PeekState } from "./use-peek";

type PeekPanelProps = {
  peek: PeekState;
  inPullRequest: (path: string) => boolean;
  onGoTo: (target: LineTarget) => void;
  onTab: (tab: PeekState["tab"]) => void;
  onClose: () => void;
};

function Definitions({
  peek,
  inPullRequest,
  onGoTo,
}: Pick<PeekPanelProps, "peek" | "inPullRequest" | "onGoTo">) {
  if (!peek.definitions) return <p className="text-sm text-muted">Looking…</p>;
  if (peek.definitions.length === 0)
    return <p className="text-sm text-muted">No definition found in this repo.</p>;
  return (
    <div className="flex flex-col gap-3">
      {peek.definitions.map((definition) => (
        <div
          key={`${definition.path}:${definition.line}`}
          className="overflow-hidden rounded-lg border border-line"
        >
          <div className="flex items-center justify-between bg-sunken px-3 py-1 text-xs">
            <span className="font-mono">
              {definition.path}:{definition.line} · {definition.kind}
            </span>
            {inPullRequest(definition.path) && (
              <button
                onClick={() => onGoTo({ path: definition.path, line: definition.line })}
                className="flex items-center gap-1 font-bold text-accent"
              >
                In this PR <ArrowRight size={12} />
              </button>
            )}
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-5">
            {definition.lines.map((text, index) => (
              <div key={index}>
                <span className="mr-3 inline-block w-8 select-none text-right text-muted">
                  {definition.line + index}
                </span>
                {text}
              </div>
            ))}
          </pre>
        </div>
      ))}
    </div>
  );
}

function References({
  peek,
  inPullRequest,
  onGoTo,
}: Pick<PeekPanelProps, "peek" | "inPullRequest" | "onGoTo">) {
  if (!peek.references) return <p className="text-sm text-muted">Searching…</p>;
  if (peek.references.length === 0)
    return <p className="text-sm text-muted">No references found.</p>;
  return (
    <ul className="flex flex-col gap-1 font-mono text-xs">
      {peek.references.map((reference) => (
        <li key={`${reference.path}:${reference.line}`} className="rounded p-1 hover:bg-sunken">
          <button
            disabled={!inPullRequest(reference.path)}
            onClick={() => onGoTo({ path: reference.path, line: reference.line })}
            className="flex w-full flex-col text-left disabled:cursor-default"
          >
            <span className={inPullRequest(reference.path) ? "text-accent" : "text-muted"}>
              {reference.path}:{reference.line}
            </span>
            <span className="truncate">{reference.text.trim()}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function PeekPanel(props: PeekPanelProps) {
  const { peek } = props;
  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto border-l border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono font-bold">{peek.name}</h2>
        <button onClick={props.onClose} title="Close (Esc)">
          <X size={18} />
        </button>
      </div>
      <div className="flex gap-2 text-sm">
        {(["definitions", "references"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => props.onTab(tab)}
            className={`rounded-full px-3 py-0.5 ${peek.tab === tab ? "bg-accent-soft font-bold text-accent" : "text-muted"}`}
          >
            {tab === "definitions" ? "Definition (gd)" : "References (gr)"}
          </button>
        ))}
      </div>
      {peek.error && <p className="text-sm text-high">{peek.error}</p>}
      {peek.tab === "definitions" ? <Definitions {...props} /> : <References {...props} />}
    </aside>
  );
}
