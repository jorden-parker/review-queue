import { Settings } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, PageShell } from "@/components/common/page-shell";
import { InboxList } from "@/components/inbox/inbox-list";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";
import { OpenPullRequestForm } from "@/components/inbox/open-pull-request-form";
import { Button } from "@/components/ui/button";

export default function InboxPage() {
  return (
    <PageShell>
      <PageHeader
        title={
          <>
            <span aria-hidden className="animate-float">
              🦦
            </span>
            Review queue
          </>
        }
        lede="One PR at a time. Pick one, follow the path, take breaks."
        action={
          <Button variant="ghost" asChild className="text-muted-foreground">
            <Link href="/settings">
              <Settings /> Settings
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<InboxSkeleton />}>
        <InboxList />
      </Suspense>
      <OpenPullRequestForm />
    </PageShell>
  );
}
