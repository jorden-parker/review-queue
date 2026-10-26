"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AppDialogProps = {
  title: ReactNode;
  onClose: () => void;
  className?: string;
  children: ReactNode;
};

export function AppDialog({ title, onClose, className, children }: AppDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        onKeyDown={(event) => event.stopPropagation()}
        className={cn(
          "scrollbar-hidden max-h-dialog gap-5 overflow-y-auto p-6 sm:max-w-lg",
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
