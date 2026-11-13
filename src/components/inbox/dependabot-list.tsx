import Link from "next/link";
import { connection } from "next/server";
import { prKey } from "@/lib/pr-ref";
import { openPullRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import { failureMessage, RequestQueue } from "./inbox-list";

export async function DependabotList() {
  await connection();
  const store = sessionStore();
  const outcome = await openPullRequests("dependabot").then(
    (requests) => ({ requests, error: null }),
    (failure: unknown) => ({ requests: [], error: failureMessage(failure) }),
  );
  const hasRepositories = savedRepositories(store).length > 0;
  return (
    <RequestQueue
      title="Open pull requests"
      requests={outcome.requests}
      progress={store.progressSummaries(outcome.requests.map((request) => prKey(request.ref)))}
      error={outcome.error}
      emptyMessage={
        hasRepositories ? (
          "No Dependabot pull requests are open. Nothing to update."
        ) : (
          <>
            Pick repositories in{" "}
            <Link href="/settings" className="text-foreground underline underline-offset-4">
              Settings
            </Link>{" "}
            to see their Dependabot PRs here.
          </>
        )
      }
    />
  );
}
