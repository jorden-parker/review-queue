import { Suspense } from "react";
import { PageHeader, PageShell } from "@/components/common/page-shell";
import { DependabotList } from "@/components/inbox/dependabot-list";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";

export default function DependabotPage() {
  return (
    <PageShell>
      <PageHeader
        title="Dependabot"
        lede="Dependency updates from your repositories, for support cover."
        backHref="/"
        backLabel="Review queue"
      />
      <Suspense fallback={<InboxSkeleton />}>
        <DependabotList />
      </Suspense>
    </PageShell>
  );
}
