"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveRepositories } from "./settings-api";

function repositoriesFrom(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function RepositoriesForm({ initial }: { initial: string[] }) {
  const [text, setText] = useState(initial.join("\n"));
  const [status, setStatus] = useState<string | null>(null);

  function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    saveRepositories(repositoriesFrom(text))
      .then((view) => {
        setText(view.repositories.join("\n"));
        setStatus("Saved.");
      })
      .catch((failure: Error) => setStatus(failure.message));
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 border-b pb-8">
      <h2 className="text-lg font-bold">Pull requests</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="repositories" className="text-sm font-bold">
          Repositories
        </label>
        <Textarea
          id="repositories"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="owner/repo"
          className="font-mono text-sm"
        />
        <p className="text-sm text-muted-foreground">
          One owner/repo per line, up to 20. Their open pull requests show on the home page.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit">Save</Button>
        <p aria-live="polite" className="empty:hidden text-sm text-muted-foreground">
          {status}
        </p>
      </div>
    </form>
  );
}
