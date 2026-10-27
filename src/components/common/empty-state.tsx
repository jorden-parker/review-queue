import type { ReactNode } from "react";

type EmptyStateProps = { emoji: string; children: ReactNode };

export function EmptyState({ emoji, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-sm text-muted-foreground">
      <span aria-hidden className="animate-float text-3xl">
        {emoji}
      </span>
      <p>{children}</p>
    </div>
  );
}
