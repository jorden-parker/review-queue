"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import { hotspotsInStep } from "./display-hotspots";
import { HotspotList } from "./hotspot-list";
import { StepExplanation } from "./step-explanation";
import type { Workspace } from "./use-workspace";

type StepSummaryProps = {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
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
            onAskMore={(check, text) =>
              workspace.assist.open(
                { kind: "check", stepId: step.id, check, path: step.files[0].path },
                "explain",
                `Tell me more: ${text}`,
              )
            }
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
      <h2 className="px-2 text-xs font-medium text-muted-foreground">Hotspots in this step</h2>
      <HotspotList
        hotspots={hotspots}
        checked={session.checkedHotspots}
        onOpen={(hotspot) => workspace.goTo({ path: hotspot.path, line: hotspot.line ?? 1 })}
        onToggleChecked={workspace.toggleHotspot}
      />
    </section>
  );
}

export function StepSummary({ review, session, workspace }: StepSummaryProps) {
  return (
    <div className="flex flex-col gap-3">
      <CurrentStep review={review} session={session} workspace={workspace} />
      <StepHotspots session={session} workspace={workspace} />
    </div>
  );
}
