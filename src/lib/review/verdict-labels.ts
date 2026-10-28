import type { ReviewEvent } from "@/lib/github/gh";

export const VERDICT_LABELS: Record<ReviewEvent, string> = {
  APPROVE: "Approved",
  REQUEST_CHANGES: "Changes requested",
  COMMENT: "Commented",
};
