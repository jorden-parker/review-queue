import { useCallback, useLayoutEffect, useRef } from "react";
import { isNearBottom } from "./stick-to-bottom";

export function useStickToBottom(content: string) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const renderedContent = useRef(content);

  useLayoutEffect(() => {
    if (renderedContent.current === content) return;
    renderedContent.current = content;
    const element = ref.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  }, [content]);

  const onScroll = useCallback(() => {
    if (ref.current) pinned.current = isNearBottom(ref.current);
  }, []);

  const pin = useCallback(() => {
    pinned.current = true;
  }, []);

  return { ref, onScroll, pin };
}
