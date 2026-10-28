type DocumentSync = {
  open(file: string): Promise<void>;
  close(file: string): Promise<void>;
};

const MAX_IDLE_DOCUMENTS = 300;

export class OpenDocuments {
  private readonly pins = new Map<string, number>();
  private readonly idle = new Set<string>();

  constructor(
    private readonly sync: DocumentSync,
    private readonly maxIdle: number = MAX_IDLE_DOCUMENTS,
  ) {}

  async pin(files: string[]): Promise<() => Promise<void>> {
    const held: string[] = [];
    for (const file of new Set(files)) {
      const wasOpen = this.isOpen(file);
      this.addPin(file);
      if (!wasOpen) {
        try {
          await this.sync.open(file);
        } catch (error) {
          this.unpin(file);
          await this.release(held);
          throw error;
        }
      }
      held.push(file);
    }
    return () => this.release(held);
  }

  private isOpen(file: string): boolean {
    return this.pins.has(file) || this.idle.has(file);
  }

  private addPin(file: string): void {
    this.idle.delete(file);
    this.pins.set(file, (this.pins.get(file) ?? 0) + 1);
  }

  private unpin(file: string): number {
    const remaining = (this.pins.get(file) ?? 0) - 1;
    if (remaining > 0) this.pins.set(file, remaining);
    else this.pins.delete(file);
    return remaining;
  }

  private async release(files: string[]): Promise<void> {
    for (const file of files) {
      if (this.unpin(file) <= 0) this.idle.add(file);
    }
    await this.evictIdle();
  }

  private async evictIdle(): Promise<void> {
    const victims = [...this.idle].slice(0, Math.max(0, this.idle.size - this.maxIdle));
    for (const file of victims) this.idle.delete(file);
    await Promise.all(victims.map((file) => this.sync.close(file).catch(() => undefined)));
  }
}
