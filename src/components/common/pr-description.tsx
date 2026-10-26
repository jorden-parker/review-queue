"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { fromHtml } from "hast-util-from-html";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { renderHast } from "./rich-text-elements";

function renderDescription(html: string) {
  return renderHast(fromHtml(html, { fragment: true }));
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
