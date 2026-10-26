import { sessionStore } from "@/lib/review/services";
import { clearCacheResponse } from "@/lib/settings/settings-service";

export function DELETE() {
  return clearCacheResponse(sessionStore());
}
