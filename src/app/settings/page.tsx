import { connection } from "next/server";
import { PageHeader, PageShell } from "@/components/common/page-shell";
import { LlmSettingsForm } from "@/components/settings/llm-settings-form";
import { sessionStore } from "@/lib/review/services";
import { settingsView } from "@/lib/settings/settings-service";

export default async function SettingsPage() {
  await connection();
  const view = await settingsView(sessionStore());
  return (
    <PageShell>
      <PageHeader
        title="Settings"
        lede="Saved here, these win over the environment variables the app started with."
        backHref="/"
        backLabel="Review queue"
      />
      <LlmSettingsForm initial={view} />
    </PageShell>
  );
}
