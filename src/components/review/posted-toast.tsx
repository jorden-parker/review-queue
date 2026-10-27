"use client";

import { X } from "lucide-react";
import { Celebration } from "@/components/common/celebration";
import { Button } from "@/components/ui/button";

export function PostedToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 animate-step-enter items-center gap-3 rounded-xl bg-card px-4 py-3 text-sm text-card-foreground shadow-lg"
    >
      <span className="relative text-lg" aria-hidden>
        🎉
        <Celebration />
      </span>
      <span className="text-sm font-medium">Review posted to GitHub. Nicely done.</span>
      <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={onDismiss}>
        <X />
      </Button>
    </div>
  );
}
