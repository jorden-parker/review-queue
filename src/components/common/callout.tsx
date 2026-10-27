import { cn } from "cn";
import type { ComponentProps } from "react";

const TONES = {
  note: "bg-callout text-callout-foreground",
  error: "bg-del text-del-foreground",
  muted: "bg-muted/60",
} as const;

type CalloutProps = ComponentProps<"div"> & { tone?: keyof typeof TONES };

export function Callout({ tone = "note", className, ...props }: CalloutProps) {
  return <div className={cn("rounded-lg px-4 py-3 text-sm", TONES[tone], className)} {...props} />;
}
