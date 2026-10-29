import type { LlmSettings } from "@/lib/settings/llm-settings";
import type { SettingsView } from "@/lib/settings/settings-service";
import { postJson } from "@/lib/json-response";

export function saveSettings(llm: LlmSettings): Promise<SettingsView> {
  return postJson<SettingsView>("/api/settings", { llm }, "PUT");
}

export function clearCache(): Promise<{ cleared: number }> {
  return postJson<{ cleared: number }>("/api/settings/cache", {}, "DELETE");
}
