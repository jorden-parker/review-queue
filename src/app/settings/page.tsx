import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { LlmSettingsForm } from "@/components/settings/llm-settings-form";
import { sessionStore } from "@/lib/review/services";
import { settingsView } from "@/lib/settings/settings-service";

export default async function SettingsPage() {
  await connection();
  const view = await settingsView(sessionStore());
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Review queue
        </Link>
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="max-w-prose text-lg text-muted-foreground">
          Saved here, these win over the environment variables the app started with.
        </p>
      </header>
      <LlmSettingsForm initial={view} />
    </main>
  );
}
