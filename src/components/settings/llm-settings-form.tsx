"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { LlmSettings } from "@/lib/settings/llm-settings";
import type { SettingsView } from "@/lib/settings/settings-service";
import { clearCache, saveSettings } from "./settings-api";

type Change = (patch: Partial<LlmSettings>) => void;

function modelChoices(view: SettingsView, chosen: string | null): string[] {
  return chosen && !view.models.includes(chosen) ? [chosen, ...view.models] : view.models;
}

function ModelField({
  view,
  settings,
  onChange,
}: {
  view: SettingsView;
  settings: LlmSettings;
  onChange: Change;
}) {
  const auto = view.autoModel ? `Auto (${view.autoModel})` : "Auto";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="model" className="text-sm font-bold">
        Model
      </label>
      <select
        id="model"
        value={settings.model ?? ""}
        onChange={(event) => onChange({ model: event.target.value || null })}
        className="h-9 rounded-lg border border-input bg-card px-3 font-mono text-sm"
      >
        <option value="">{auto}</option>
        {modelChoices(view, settings.model).map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckField({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-bold">
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function TimeoutField({
  seconds,
  onChange,
}: {
  seconds: string;
  onChange: (seconds: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="timeout" className="text-sm font-bold">
        Timeout (seconds)
      </label>
      <Input
        id="timeout"
        type="number"
        min={1}
        value={seconds}
        onChange={(event) => onChange(event.target.value)}
        className="w-32"
      />
    </div>
  );
}

function CacheSection() {
  const [status, setStatus] = useState<string | null>(null);

  function clear() {
    clearCache()
      .then(({ cleared }) => setStatus(`Cleared ${cleared} cached entries.`))
      .catch((failure: Error) => setStatus(failure.message));
  }

  return (
    <section className="flex flex-col gap-3 border-t pt-8">
      <h2 className="text-lg font-bold">Cache</h2>
      <p className="text-sm text-muted-foreground">
        Removes saved orientations, step explanations and GitHub responses. They are fetched again
        the next time you open a PR.
      </p>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={clear}>
          Clear cache
        </Button>
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
      </div>
    </section>
  );
}

export function LlmSettingsForm({ initial }: { initial: SettingsView }) {
  const [view, setView] = useState(initial);
  const [settings, setSettings] = useState(initial.llm);
  const [seconds, setSeconds] = useState(String(initial.llm.timeoutMs / 1000));
  const [status, setStatus] = useState<string | null>(null);
  const change: Change = (patch) => setSettings((current) => ({ ...current, ...patch }));

  function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    saveSettings({ ...settings, timeoutMs: Number(seconds) * 1000 })
      .then((next) => {
        setView(next);
        setSettings(next.llm);
        setStatus("Saved.");
      })
      .catch((failure: Error) => setStatus(failure.message));
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={save} className="flex flex-col gap-6">
        <h2 className="text-lg font-bold">Local model</h2>
        <CheckField
          id="enabled"
          label="Use the local model"
          hint="Orientation, step explanations, summary drafts and Ask."
          checked={settings.enabled}
          onChange={(enabled) => change({ enabled })}
        />
        <ModelField view={view} settings={settings} onChange={change} />
        <CheckField
          id="thinking"
          label="Let the model think before answering"
          hint="Turn off only for models that answer directly. Qwen models repeat themselves without it."
          checked={settings.thinking}
          onChange={(thinking) => change({ thinking })}
        />
        <TimeoutField seconds={seconds} onChange={setSeconds} />
        <div className="flex items-center gap-3">
          <Button type="submit">Save</Button>
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </div>
      </form>
      <CacheSection />
    </div>
  );
}
