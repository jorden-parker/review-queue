import { Settings } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { InboxList } from "@/components/inbox/inbox-list";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";
import { OpenPullRequestForm } from "@/components/inbox/open-pull-request-form";
import { Button } from "@/components/ui/button";

export default function InboxPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="flex items-center gap-3 text-4xl font-bold">
            <span aria-hidden className="animate-float">
              🦦
            </span>
            Review queue
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">
            One PR at a time. Pick one, follow the path, take breaks.
          </p>
        </div>
        <Button variant="ghost" asChild className="text-muted-foreground">
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </Button>
      </header>
      <OpenPullRequestForm />
      <Suspense fallback={<InboxSkeleton />}>
        <InboxList />
      </Suspense>
    </main>
  );
}
