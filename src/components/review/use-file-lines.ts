"use client";

import { useCallback, useMemo, useState } from "react";
import { memoizePromise } from "@/lib/memoize-promise";
import type { FileLines } from "@/lib/review/file-lines";
import type { PullRequestRef } from "@/lib/types";
import { fetchFileLines } from "./api";

export type LoadFile = (path: string) => Promise<FileLines>;

export type FileLoad = { lines: FileLines | null; loading: boolean; failed: boolean };

const NOT_LOADED: FileLoad = { lines: null, loading: false, failed: false };

function cachedLoader(ref: PullRequestRef, headSha: string): LoadFile {
  const loaded = new Map<string, Promise<FileLines>>();
  return (path) => memoizePromise(loaded, path, () => fetchFileLines(ref, headSha, path));
}

export function useFileLoader(ref: PullRequestRef, headSha: string): LoadFile {
  return useMemo(() => cachedLoader(ref, headSha), [ref, headSha]);
}

export function useFileLines(loadFile: LoadFile, path: string) {
  const [load, setLoad] = useState<FileLoad>(NOT_LOADED);
  const request = useCallback(() => {
    setLoad((current) => (current.lines ? current : { ...NOT_LOADED, loading: true }));
    loadFile(path)
      .then((lines) => setLoad({ ...NOT_LOADED, lines }))
      .catch(() => setLoad({ ...NOT_LOADED, failed: true }));
  }, [loadFile, path]);
  return { load, request };
}
