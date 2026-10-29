import { cn } from "cn";

type PathLabelProps = {
  path: string;
  line?: number | null;
  startLine?: number | null;
  truncate?: boolean;
  className?: string;
};

export function splitPath(path: string): { directory: string; name: string } {
  const slash = path.lastIndexOf("/");
  return { directory: path.slice(0, slash + 1), name: path.slice(slash + 1) };
}

function lineSpanOf(line: number, startLine: number | null | undefined): string {
  return startLine ? `${startLine}–${line}` : `${line}`;
}

export function PathLabel({ path, line, startLine, truncate = false, className }: PathLabelProps) {
  const { directory, name } = splitPath(path);
  return (
    <span
      className={cn(
        "min-w-0 font-mono text-xs",
        truncate ? "truncate" : "wrap-anywhere",
        className,
      )}
      title={path}
    >
      <span className="text-muted-foreground">{directory}</span>
      <span className="font-medium text-foreground">{name}</span>
      {line ? <span className="text-muted-foreground">:{lineSpanOf(line, startLine)}</span> : null}
    </span>
  );
}
