import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type PageShellProps = { children: ReactNode };

export function PageShell({ children }: PageShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 py-12 sm:px-6 sm:py-16">
      {children}
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
    <header className="relative flex flex-col gap-3">
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute -inset-x-6 -top-12 -bottom-4 -z-10"
      />
      {backHref && (
        <Button variant="ghost" size="sm" asChild className="-ml-2.5 w-fit text-muted-foreground">
          <Link href={backHref}>
            <ArrowLeft /> {backLabel}
          </Link>
        </Button>
      )}
      <div className="flex items-start justify-between gap-6">
        <h1 className="flex items-center gap-3 text-5xl font-semibold tracking-tighter">{title}</h1>
        {action}
      </div>
      {lede && <p className="max-w-prose text-lg text-muted-foreground">{lede}</p>}
    </header>
  );
}
