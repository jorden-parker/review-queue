import type { ReactNode } from "react";
import type { Components } from "hast-util-to-jsx-runtime";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { defaultHandlers, toHast, type Handler } from "mdast-util-to-hast";
import { gfm } from "micromark-extension-gfm";
import { renderHast, RichLink } from "./rich-text-elements";

type MarkdownTree = ReturnType<typeof fromMarkdown>;
type MarkdownNode = Parameters<typeof toHast>[0];

export type CitationRenderer = {
  indexOf: (code: string) => number | null;
  render: (index: number, code: string) => ReactNode;
};

const WITHOUT_IMAGES = { handlers: { image: () => undefined, imageReference: () => undefined } };
const CITATION_HREF_PREFIX = "#cite-";

function citationHandler(indexOf: CitationRenderer["indexOf"]): Handler {
  return (state, node) => {
    const index = indexOf(node.value);
    if (index === null) return defaultHandlers.inlineCode(state, node);
    return {
      type: "element",
      tagName: "a",
      properties: { href: `${CITATION_HREF_PREFIX}${index}` },
      children: [{ type: "text", value: node.value }],
    };
  };
}

function safeOptions(citations?: CitationRenderer) {
  if (!citations) return WITHOUT_IMAGES;
  return {
    handlers: {
      ...WITHOUT_IMAGES.handlers,
      inlineCode: citationHandler(citations.indexOf),
    },
  };
}

function toSafeHast(node: MarkdownNode, citations?: CitationRenderer) {
  return toHast(node, safeOptions(citations));
}

export function parseMarkdown(text: string): MarkdownTree {
  return fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}

function inlineHast(tree: MarkdownTree) {
  const [only, ...rest] = tree.children;
  if (only?.type !== "paragraph" || rest.length > 0) return toSafeHast(tree);
  const paragraph = toSafeHast(only);
  return paragraph.type === "element"
    ? { type: "root" as const, children: paragraph.children }
    : paragraph;
}

function citationIndex(href: string | undefined): number | null {
  if (!href?.startsWith(CITATION_HREF_PREFIX)) return null;
  const index = Number(href.slice(CITATION_HREF_PREFIX.length));
  return Number.isInteger(index) ? index : null;
}

function citationComponents(citations: CitationRenderer): Partial<Components> {
  return {
    a: (props) => {
      const index = citationIndex(props.href);
      if (index === null) return <RichLink {...props} />;
      return <>{citations.render(index, String(props.children))}</>;
    },
  };
}

export function Markdown({
  text,
  className,
  citations,
}: {
  text: string;
  className?: string;
  citations?: CitationRenderer;
}) {
  const tree = toSafeHast(parseMarkdown(text), citations);
  const components = citations && citationComponents(citations);
  return <div className={className}>{renderHast(tree, components)}</div>;
}

export function InlineMarkdown({ text }: { text: string }) {
  return renderHast(inlineHast(parseMarkdown(text)));
}
