export function runnableHunkMove(pending: number, fileOpen: boolean): number | null {
  if (fileOpen || pending === 0) return null;
  return pending;
}
