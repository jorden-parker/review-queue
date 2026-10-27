import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_ROW_COUNT = 3;

export function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="Asking GitHub what needs your review">
      <Skeleton className="h-7 w-44" />
      <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }, (_, index) => (
          <li key={index} className="flex items-center gap-4 px-5 py-4">
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-1/3" />
            </span>
            <Skeleton className="h-5 w-24 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
