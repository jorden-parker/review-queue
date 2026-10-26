import { Suspense } from "react";
import { InboxList } from "@/components/inbox/inbox-list";
import { OpenPullRequestForm } from "@/components/inbox/open-pull-request-form";

export default function InboxPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Review queue</h1>
        <p className="text-muted">One PR at a time. Pick one, follow the path, take breaks.</p>
      </header>
      <OpenPullRequestForm />
      <Suspense fallback={<p className="text-muted">Asking GitHub what needs your review…</p>}>
        <InboxList />
      </Suspense>
    </main>
  );
}
