import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type PageShellProps = { children: ReactNode };

export function PageShell({ children }: PageShellProps) {
  return (
    <main id="main" tabIndex={0} className="relative h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
        {children}
      </div>
    </main>
  );
}

type PageHeaderProps = {
  title: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({ title, lede, action, backHref, backLabel }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {backHref && (
        <Button variant="ghost" size="sm" asChild className="-ml-2.5 w-fit text-muted-foreground">
          <Link href={backHref}>
            <ArrowLeft /> {backLabel}
          </Link>
        </Button>
      )}
      <div className="flex items-start justify-between gap-6">
        <h1 className="flex min-w-0 items-center gap-3 text-4xl font-semibold tracking-tight wrap-anywhere">
          {title}
        </h1>
        {action}
      </div>
      {lede && <p className="max-w-prose text-base text-muted-foreground">{lede}</p>}
    </header>
  );
}
