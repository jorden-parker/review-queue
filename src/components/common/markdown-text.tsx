import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { toHast } from "mdast-util-to-hast";
import { gfm } from "micromark-extension-gfm";
import { renderHast } from "./rich-text-elements";

type MarkdownTree = ReturnType<typeof fromMarkdown>;

function parseMarkdown(text: string): MarkdownTree {
  return fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}

function inlineHast(tree: MarkdownTree) {
  const [only, ...rest] = tree.children;
  if (only?.type !== "paragraph" || rest.length > 0) return toHast(tree);
  const paragraph = toHast(only);
  return paragraph.type === "element"
    ? { type: "root" as const, children: paragraph.children }
    : paragraph;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={className}>{renderHast(toHast(parseMarkdown(text)))}</div>;
}

export function InlineMarkdown({ text }: { text: string }) {
  return renderHast(inlineHast(parseMarkdown(text)));
}
