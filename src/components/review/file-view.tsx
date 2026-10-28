"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Callout } from "@/components/common/callout";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SymbolPosition } from "@/lib/types";
import { CodeRows, LoadingRows } from "./code-rows";
import type { LineTarget } from "./locate";
import { useFileLines, type LoadFile } from "./use-file-lines";

type FileViewProps = {
  target: LineTarget;
  loadFile: LoadFile;
  onIdentifier: (position: SymbolPosition) => void;
  onClose: () => void;
};

type FileContentsProps = Pick<FileViewProps, "target" | "onIdentifier"> & {
  load: ReturnType<typeof useFileLines>["load"];
};

function FileContents({ target, load, onIdentifier }: FileContentsProps) {
  if (load.failed) return <Callout tone="error">Could not load the file.</Callout>;
  if (!load.lines) return <LoadingRows />;
  return (
    <>
      <CodeRows
        path={target.path}
        startLine={1}
        tokens={load.lines.tokens}
        focus={{ from: target.line, to: target.endLine ?? target.line }}
        onIdentifier={onIdentifier}
      />
      {load.lines.truncated && (
        <p className="px-3 pb-2 text-sm text-muted-foreground">The file is cut at 300 KB.</p>
      )}
    </>
  );
}

export function FileView({ target, loadFile, onIdentifier, onClose }: FileViewProps) {
  const { load, request } = useFileLines(loadFile, target.path);
  useEffect(request, [request]);
  return (
    <div className="flex flex-col rounded-lg border bg-card">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-muted px-3 py-2">
        <PathLabel path={target.path} line={target.line} className="min-w-40 flex-1" />
        <Badge variant="outline">Read only · not in this PR</Badge>
        <Button variant="ghost" size="xs" onClick={onClose}>
          <ArrowLeft />
          Back to the review
        </Button>
      </div>
      <FileContents target={target} load={load} onIdentifier={onIdentifier} />
    </div>
  );
}
