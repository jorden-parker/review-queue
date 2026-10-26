import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { sanitize } from "hast-util-sanitize";
import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";

type HastTree = Parameters<typeof sanitize>[0];

const RICH_TEXT_ELEMENTS: Partial<Components> = {
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

export function renderHast(tree: HastTree) {
  return toJsxRuntime(sanitize(tree), { Fragment, jsx, jsxs, components: RICH_TEXT_ELEMENTS });
}
