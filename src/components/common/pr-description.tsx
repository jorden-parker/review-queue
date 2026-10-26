"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { fromHtml } from "hast-util-from-html";
import { sanitize } from "hast-util-sanitize";
import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

const DESCRIPTION_ELEMENTS: Partial<Components> = {
  h1: ({ children }) => <h3 className="font-semibold text-foreground">{children}</h3>,
  h2: ({ children }) => <h3 className="font-semibold text-foreground">{children}</h3>,
  h3: ({ children }) => <h4 className="font-medium text-foreground">{children}</h4>,
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="flex list-decimal flex-col gap-1 pl-5">{children}</ol>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg bg-muted p-3 [&_code]:p-0">{children}</pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      {children}
    </a>
  ),
};

function renderDescription(html: string) {
  const tree = sanitize(fromHtml(html, { fragment: true }));
  return toJsxRuntime(tree, { Fragment, jsx, jsxs, components: DESCRIPTION_ELEMENTS });
}

function useOverflows(content: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) setOverflows(element.scrollHeight > element.clientHeight);
  }, [content]);
  return { ref, overflows };
}

export function PrDescription({ html }: { html: string }) {
  const [expanded, setExpanded] = useState(false);
  const description = useMemo(() => renderDescription(html), [html]);
  const { ref, overflows } = useOverflows(html);
  const collapsed = overflows && !expanded;
  return (
    <div className="flex flex-col items-start gap-1">
      <div
        ref={ref}
        className={cn(
          "flex w-full flex-col gap-2 text-sm wrap-anywhere text-muted-foreground [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded",
          !expanded && "max-h-40 overflow-hidden",
          collapsed && "mask-b-from-50%",
        )}
      >
        {description}
      </div>
      {overflows && (
        <Button variant="link" size="xs" className="px-0" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}
