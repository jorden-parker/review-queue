import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_ROW_COUNT = 3;

export function InboxSkeleton() {
  return (
    <div
      role="status"
      className="flex flex-col gap-3"
      aria-label="Asking GitHub what needs your review"
    >
      <Skeleton className="h-4 w-40" />
      <ul className="divide-y overflow-hidden rounded-xl bg-card border">
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }, (_, index) => (
          <li key={index} className="flex min-h-11 items-center gap-4 px-5 py-3">
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-1/3" />
            </span>
            <Skeleton className="h-4 w-12" />
          </li>
        ))}
      </ul>
    </div>
  );
}
