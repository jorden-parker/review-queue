import { connection } from "next/server";
import { PageHeader, PageShell } from "@/components/common/page-shell";
import { LlmSettingsForm } from "@/components/settings/llm-settings-form";
import { RepositoriesForm } from "@/components/settings/repositories-form";
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
      <div className="flex flex-col gap-8">
        <RepositoriesForm initial={view.repositories} />
        <LlmSettingsForm initial={view} />
      </div>
    </PageShell>
  );
}
