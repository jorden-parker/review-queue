function failureText(status: number, statusText: string): string {
  return statusText ? `Request failed (${status} ${statusText})` : `Request failed (${status})`;
}

async function failureMessage(response: Response): Promise<string> {
  const fallback = failureText(response.status, response.statusText);
  const body: unknown = await response.json().catch(() => null);
  const error = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  return typeof error === "string" ? error : fallback;
}

export async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await failureMessage(response));
  return (await response.json()) as T;
}

export function postJson<T>(
  url: string,
  body: unknown,
  method = "POST",
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  return fetchImpl(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(json<T>);
}
