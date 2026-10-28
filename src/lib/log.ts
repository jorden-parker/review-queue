export function logServerError(scope: string, error: unknown): void {
  console.error(`review-queue: ${scope} failed`, error);
}
