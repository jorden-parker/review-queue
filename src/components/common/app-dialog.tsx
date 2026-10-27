"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AppDialogProps = {
  title: ReactNode;
  onClose: () => void;
  className?: string;
  wide?: boolean;
  children: ReactNode;
};

export function AppDialog({ title, onClose, className, wide = false, children }: AppDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        onKeyDown={(event) => event.stopPropagation()}
        className={cn(
          "max-h-dialog gap-5 overflow-y-auto p-6",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
