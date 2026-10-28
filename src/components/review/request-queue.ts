export type Entry<T> = [key: string, value: T];

export function createLimiter(limit: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  const finish = () => {
    running -= 1;
    waiting.shift()?.();
  };
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const start = () => {
        running += 1;
        void task().then(resolve, reject).finally(finish);
      };
      if (running < limit) start();
      else waiting.push(start);
    });
}

export function createFrameBatcher<T>(
  publish: (entries: Entry<T>[]) => void,
  requestFrame: (run: () => void) => unknown,
): (key: string, value: T) => void {
  let queued: Entry<T>[] = [];
  let frameRequested = false;
  const flush = () => {
    const entries = queued;
    queued = [];
    frameRequested = false;
    publish(entries);
  };
  return (key, value) => {
    queued.push([key, value]);
    if (frameRequested) return;
    frameRequested = true;
    requestFrame(flush);
  };
}
