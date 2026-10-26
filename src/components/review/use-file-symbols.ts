"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OutlineSymbol, PullRequestRef, ReferenceCount } from "@/lib/types";
import { fetchOutline, fetchReferenceCounts } from "./api";

type LoadPath<T> = (path: string) => Promise<T>;
type Loaded<T> = { load: LoadPath<T>; values: ReadonlyMap<string, T> };

const NOTHING_LOADED: ReadonlyMap<string, never> = new Map<string, never>();

function withValue<T>(loaded: Loaded<T>, load: LoadPath<T>, path: string, value: T): Loaded<T> {
  const values = loaded.load === load ? new Map(loaded.values) : new Map<string, T>();
  return { load, values: values.set(path, value) };
}

function usePathData<T>(load: LoadPath<T>, paths: string[]): ReadonlyMap<string, T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ load, values: NOTHING_LOADED });
  const requested = useRef({ load, paths: new Set<string>() });
  const pathList = paths.join("\n");

  useEffect(() => {
    if (requested.current.load !== load) requested.current = { load, paths: new Set() };
    const pending = requested.current.paths;
    for (const path of pathList.split("\n").filter(Boolean)) {
      if (pending.has(path)) continue;
      pending.add(path);
      load(path)
        .then((value) => setLoaded((current) => withValue(current, load, path, value)))
        .catch(() => pending.delete(path));
    }
  }, [load, pathList]);

  return loaded.load === load ? loaded.values : NOTHING_LOADED;
}

export function useReferenceCounts(
  ref: PullRequestRef,
  headSha: string,
  paths: string[],
): ReadonlyMap<string, ReferenceCount[]> {
  const load = useCallback(
    (path: string) => fetchReferenceCounts(ref, headSha, path),
    [ref, headSha],
  );
  return usePathData(load, paths);
}

export function useOutlines(
  ref: PullRequestRef,
  headSha: string,
  paths: string[],
): ReadonlyMap<string, OutlineSymbol[]> {
  const load = useCallback((path: string) => fetchOutline(ref, headSha, path), [ref, headSha]);
  return usePathData(load, paths);
}
