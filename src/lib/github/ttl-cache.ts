type Entry = { value: Promise<unknown>; expiresAt: number };

export class TtlCache {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  get<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > this.now()) return existing.value as Promise<T>;
    const value = load();
    const entry = { value, expiresAt: this.now() + ttlMs };
    this.entries.set(key, entry);
    value.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return value;
  }

  forget(key: string): void {
    this.entries.delete(key);
  }
}
