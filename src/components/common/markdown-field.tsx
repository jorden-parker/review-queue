"use client";

import { type ComponentProps, type KeyboardEventHandler, useState } from "react";
import { Markdown } from "@/components/common/markdown-text";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Mode = "write" | "preview";

type MarkdownFieldProps = Omit<ComponentProps<typeof Textarea>, "onKeyDown"> & {
  value: string;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
};

export function MarkdownField({ onKeyDown, autoFocus, ...textareaProps }: MarkdownFieldProps) {
  const [mode, setMode] = useState<Mode>("write");
  const [returnedToWrite, setReturnedToWrite] = useState(false);
  const chooseMode = (next: string) => {
    if (next !== "write" && next !== "preview") return;
    setMode(next);
    setReturnedToWrite(next === "write");
  };
  return (
    <div className="flex flex-col gap-1" onKeyDown={onKeyDown}>
      <ToggleGroup
        type="single"
        size="sm"
        value={mode}
        onValueChange={chooseMode}
        className="self-start"
      >
        <ToggleGroupItem value="write" className="text-xs">
          Write
        </ToggleGroupItem>
        <ToggleGroupItem value="preview" className="text-xs">
          Preview
        </ToggleGroupItem>
      </ToggleGroup>
      {mode === "write" ? (
        <Textarea autoFocus={autoFocus || returnedToWrite} {...textareaProps} />
      ) : (
        <MarkdownPreview text={textareaProps.value} />
      )}
    </div>
  );
}

function MarkdownPreview({ text }: { text: string }) {
  if (!text.trim()) {
    return (
      <p className="min-h-16 rounded-lg border px-2.5 py-2 text-muted-foreground">
        Nothing to preview
      </p>
    );
  }
  return (
    <Markdown text={text} className="flex min-h-16 flex-col gap-2 rounded-lg border px-2.5 py-2" />
  );
}
