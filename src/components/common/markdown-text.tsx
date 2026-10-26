import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { toHast } from "mdast-util-to-hast";
import { gfm } from "micromark-extension-gfm";
import { renderHast } from "./rich-text-elements";

type MarkdownTree = ReturnType<typeof fromMarkdown>;
type MarkdownNode = Parameters<typeof toHast>[0];

const WITHOUT_IMAGES = { handlers: { image: () => undefined, imageReference: () => undefined } };

function toSafeHast(node: MarkdownNode) {
  return toHast(node, WITHOUT_IMAGES);
}

function parseMarkdown(text: string): MarkdownTree {
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

export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={className}>{renderHast(toSafeHast(parseMarkdown(text)))}</div>;
}

export function InlineMarkdown({ text }: { text: string }) {
  return renderHast(inlineHast(parseMarkdown(text)));
}
