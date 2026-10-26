"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type HintButtonProps = ComponentProps<typeof Button> & { hint: string; shortcut?: string };

export function HintButton({ hint, shortcut, ...buttonProps }: HintButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...buttonProps} />
      </TooltipTrigger>
      <TooltipContent>
        {hint}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
