"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parsePullRequestRef, prPath } from "@/lib/pr-ref";

export function OpenPullRequestForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  function open(event: React.FormEvent) {
    event.preventDefault();
    const ref = parsePullRequestRef(text);
    setInvalid(ref === null);
    if (ref) router.push(prPath(ref));
  }

  return (
    <form onSubmit={open} className="flex flex-col gap-2">
      <label htmlFor="pr" className="text-sm font-bold">
        Open any PR
      </label>
      <div className="flex gap-2">
        <input
          id="pr"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="https://github.com/owner/repo/pull/123 or owner/repo#123"
          className="flex-1 rounded-lg border border-line bg-panel px-3 py-2 font-mono text-sm outline-none focus:border-accent"
        />
        <button className="rounded-lg bg-accent px-4 py-2 font-bold text-panel">Open</button>
      </div>
      {invalid && <p className="text-sm text-high">That doesn&apos;t look like a PR link.</p>}
    </form>
  );
}
