import type { ComponentProps } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { sanitize } from "hast-util-sanitize";
import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";

type HastTree = Parameters<typeof sanitize>[0];

export function RichLink({ children, href }: ComponentProps<"a">) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

const RICH_TEXT_ELEMENTS: Partial<Components> = {
  h1: ({ children }) => <h3 className="font-bold text-foreground">{children}</h3>,
  h2: ({ children }) => <h3 className="font-bold text-foreground">{children}</h3>,
  h3: ({ children }) => <h4 className="font-medium text-foreground">{children}</h4>,
  h4: ({ children }) => <h4 className="font-medium text-foreground">{children}</h4>,
  h5: ({ children }) => <h4 className="font-medium text-foreground">{children}</h4>,
  h6: ({ children }) => <h4 className="font-medium text-foreground">{children}</h4>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="border-border" />,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-2 py-1 font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b px-2 py-1 align-top">{children}</td>,
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="flex list-decimal flex-col gap-1 pl-5">{children}</ol>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-code leading-none text-foreground">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="rounded-lg bg-muted p-3 tab-2 break-words whitespace-pre-wrap wrap-anywhere [&_code]:p-0 [&_code]:leading-normal">
      {children}
    </pre>
  ),
  a: RichLink,
};

export function renderHast(tree: HastTree, components?: Partial<Components>) {
  return toJsxRuntime(sanitize(tree), {
    Fragment,
    jsx,
    jsxs,
    components: { ...RICH_TEXT_ELEMENTS, ...components },
  });
}
