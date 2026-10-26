import { sessionStore } from "@/lib/review/services";
import { settingsView, updateSettings } from "@/lib/settings/settings-service";

export async function GET() {
  return Response.json(await settingsView(sessionStore()));
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  return updateSettings(sessionStore(), body);
}
