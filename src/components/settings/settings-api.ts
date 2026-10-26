import type { LlmSettings } from "@/lib/settings/llm-settings";
import type { SettingsView } from "@/lib/settings/settings-service";
import { json } from "@/lib/json-response";

function send(method: string, url: string, body: unknown = {}): Promise<Response> {
  return fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function saveSettings(llm: LlmSettings): Promise<SettingsView> {
  return send("PUT", "/api/settings", { llm }).then(json<SettingsView>);
}

export function clearCache(): Promise<{ cleared: number }> {
  return send("DELETE", "/api/settings/cache").then(json<{ cleared: number }>);
}
