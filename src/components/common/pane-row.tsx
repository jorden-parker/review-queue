import { cn } from "cn";
import type { ComponentProps } from "react";

type PaneRowProps = ComponentProps<"li"> & { active?: boolean };

export function PaneRow({ active = false, className, ...props }: PaneRowProps) {
  return (
    <li
      className={cn(
        "-mx-2 flex items-start gap-2 rounded-lg px-2 py-2 transition-colors duration-calm",
        active ? "bg-accent" : "hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}
