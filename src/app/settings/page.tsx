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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Review queue
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Saved here, these win over the environment variables the app started with.
        </p>
      </header>
      <LlmSettingsForm initial={view} />
    </main>
  );
}
