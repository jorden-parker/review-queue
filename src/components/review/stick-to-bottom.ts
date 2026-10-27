const STICK_THRESHOLD_PX = 32;

type ScrollMetrics = { scrollTop: number; scrollHeight: number; clientHeight: number };

export function isNearBottom({ scrollTop, scrollHeight, clientHeight }: ScrollMetrics): boolean {
  return scrollHeight - scrollTop - clientHeight <= STICK_THRESHOLD_PX;
}
