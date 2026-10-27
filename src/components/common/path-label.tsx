import { cn } from "cn";

type PathLabelProps = { path: string; line?: number | null; wrap?: boolean; className?: string };

export function splitPath(path: string): { directory: string; name: string } {
  const slash = path.lastIndexOf("/");
  return { directory: path.slice(0, slash + 1), name: path.slice(slash + 1) };
}

export function PathLabel({ path, line, wrap = false, className }: PathLabelProps) {
  const { directory, name } = splitPath(path);
  return (
    <span
      className={cn("min-w-0 font-mono text-xs", wrap ? "wrap-anywhere" : "truncate", className)}
      title={path}
    >
      <span className="text-muted-foreground">{directory}</span>
      <span className="font-medium text-foreground">{name}</span>
      {line ? <span className="text-muted-foreground">:{line}</span> : null}
    </span>
  );
}
