"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <form onSubmit={open} className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Open any PR</h2>
      <div className="flex flex-col gap-2">
        <label htmlFor="pr" className="sr-only">
          PR link or owner/repo#number
        </label>
        <div className="flex gap-2">
          <Input
            id="pr"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="https://github.com/owner/repo/pull/123 or owner/repo#123"
            className="flex-1 font-mono"
          />
          <Button type="submit">
            Open <ArrowRight />
          </Button>
        </div>
        {invalid && (
          <p className="text-sm text-destructive">That doesn&apos;t look like a PR link.</p>
        )}
      </div>
    </form>
  );
}
