export function nextStopIndex(index: number, key: string, count: number): number | null {
  if (count === 0) return null;
  const last = count - 1;
  switch (key) {
    case "ArrowDown":
      return Math.min(index + 1, last);
    case "ArrowUp":
      return Math.max(index - 1, 0);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
