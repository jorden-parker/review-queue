import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { RainbowRule } from "@/components/common/otter";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parsePullRequestRef, prPath } from "@/lib/pr-ref";
import type { InProgressSession } from "@/lib/session/store";
import { relativeTime } from "./in-progress-list";

export function NextUp({ session }: { session: InProgressSession }) {
  const ref = parsePullRequestRef(session.key);
  if (!ref) return null;
  return (
    <section aria-labelledby="next-up-heading" className="flex flex-col gap-3">
      <h2 id="next-up-heading" className="text-sm font-semibold text-muted-foreground">
        Pick up where you left off
      </h2>
      <Card className="relative gap-3 px-6 py-5">
        <RainbowRule className="absolute inset-x-0 top-0" />
        <p className="text-sm text-muted-foreground">
          {ref.owner}/{ref.repo} · #{ref.number}
        </p>
        <h3 className="text-xl font-semibold">
          <InlineMarkdown text={session.title ?? session.key} />
        </h3>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            {session.doneCount} {session.doneCount === 1 ? "step" : "steps"} done
          </span>
          <span>Last worked {relativeTime(session.updatedAt)}</span>
          {session.pauseNote && <span>You were about to: {session.pauseNote}</span>}
        </p>
        <div className="flex justify-end">
          <Button asChild>
            <Link href={prPath(ref)}>
              Resume review <ArrowRight />
            </Link>
          </Button>
        </div>
      </Card>
    </section>
  );
}
