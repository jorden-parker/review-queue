import { Skeleton } from "@/components/ui/skeleton";

export function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="Asking GitHub what needs your review">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-60 w-full rounded-xl" />
    </div>
  );
}
