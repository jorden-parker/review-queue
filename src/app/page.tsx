import { Suspense } from "react";
import { InboxList } from "@/components/inbox/inbox-list";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";
import { OpenPullRequestForm } from "@/components/inbox/open-pull-request-form";

export default function InboxPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <span aria-hidden className="animate-float">
            🦦
          </span>
          Review queue
        </h1>
        <p className="text-muted-foreground">
          One PR at a time. Pick one, follow the path, take breaks.
        </p>
      </header>
      <OpenPullRequestForm />
      <Suspense fallback={<InboxSkeleton />}>
        <InboxList />
      </Suspense>
    </main>
  );
}
