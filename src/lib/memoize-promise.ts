type PromiseCache<K, V> = {
  get(key: K): Promise<V> | undefined;
  set(key: K, value: Promise<V>): unknown;
  delete(key: K): unknown;
};

export function memoizePromise<K, V>(
  cache: PromiseCache<K, V>,
  key: K,
  make: () => Promise<V>,
): Promise<V> {
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = make();
  cache.set(key, pending);
  pending.catch(() => {
    if (cache.get(key) === pending) cache.delete(key);
  });
  return pending;
}
