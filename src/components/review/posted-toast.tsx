"use client";

import { X } from "lucide-react";
import { Celebration } from "@/components/common/celebration";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PostedToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card
      role="status"
      className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 animate-step-enter flex-row items-center gap-3 overflow-visible px-4 shadow-lg"
    >
      <span className="relative text-lg" aria-hidden>
        🎉
        <Celebration />
      </span>
      <span className="text-sm font-medium">Review posted to GitHub. Nicely done.</span>
      <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={onDismiss}>
        <X />
      </Button>
    </Card>
  );
}
