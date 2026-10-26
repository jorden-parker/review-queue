"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import { hotspotsInStep } from "./display-hotspots";
import { HotspotList } from "./hotspot-list";
import { OrientationCard } from "./orientation-card";
import { StepExplanation } from "./step-explanation";
import type { OrientationState } from "./use-review";
import type { Workspace } from "./use-workspace";

type StepRailProps = {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
  orientation: OrientationState;
  fresh: boolean;
  assist: ReactNode;
};

function CurrentStep({
  review,
  session,
  workspace,
}: {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
}) {
  const step = workspace.currentStep;
  if (!step) return null;
  const done = session.doneSteps.includes(step.id);
  return (
    <Card>
      <CardHeader>
        <CardDescription className="font-mono text-xs">
          Step {workspace.currentIndex + 1} of {review.steps.length} · {step.role} ·{" "}
          {step.changedLines} lines
        </CardDescription>
        <CardTitle className="text-lg font-semibold tracking-tight">{step.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{step.reason}</p>
        {done && (
          <Badge className="animate-pop bg-add text-add-foreground">
            <Check /> Done
          </Badge>
        )}
        {workspace.aiEnabled && (
          <StepExplanation
            key={step.id}
            pullRequest={review.pr.ref}
            headSha={review.headSha}
            stepId={step.id}
          />
        )}
      </CardContent>
    </Card>
  );
}

function StepHotspots({ session, workspace }: { session: Session; workspace: Workspace }) {
  const step = workspace.currentStep;
  const hotspots = step ? hotspotsInStep(workspace.hotspots, step) : [];
  if (hotspots.length === 0) return null;
  return (
    <section aria-label="Hotspots in this step" className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-medium text-muted-foreground">Hotspots in this step</h2>
      <HotspotList
        hotspots={hotspots}
        checked={session.checkedHotspots}
        onOpen={(hotspot) => workspace.goTo({ path: hotspot.path, line: hotspot.line ?? 1 })}
        onToggleChecked={workspace.toggleHotspot}
      />
    </section>
  );
}

export function StepRail({
  review,
  session,
  workspace,
  orientation,
  fresh,
  assist,
}: StepRailProps) {
  return (
    <aside aria-label="This step" className="flex min-h-0 flex-col border-l bg-background">
      <div
        className={cn(
          "scrollbar-hidden flex min-h-0 flex-col gap-3 overflow-y-auto p-3",
          workspace.assist.thread ? "shrink-0 basis-1/2" : "flex-1",
        )}
      >
        <CurrentStep review={review} session={session} workspace={workspace} />
        <StepHotspots session={session} workspace={workspace} />
        <OrientationCard
          key={fresh ? "fresh" : "started"}
          review={review}
          orientation={orientation}
          fresh={fresh}
        />
      </div>
      {assist}
    </aside>
  );
}
