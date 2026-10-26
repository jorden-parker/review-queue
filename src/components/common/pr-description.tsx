"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

const MARKDOWN_ELEMENTS: Components = {
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

function useOverflows(content: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) setOverflows(element.scrollHeight > element.clientHeight);
  }, [content]);
  return { ref, overflows };
}

export function PrDescription({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const { ref, overflows } = useOverflows(body);
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
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
          components={MARKDOWN_ELEMENTS}
        >
          {body}
        </Markdown>
      </div>
      {overflows && (
        <Button variant="link" size="xs" className="px-0" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}
