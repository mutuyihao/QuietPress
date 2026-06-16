export async function readApiJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(body, response.statusText || "Request failed"),
    );
  }

  if (body && typeof body === "object" && "ok" in body) {
    if (body.ok === true && "data" in body) return body.data as T;
    if (body.ok === false)
      throw new Error(getApiErrorMessage(body, "Request failed"));
  }

  return body as T;
}

export function getApiErrorMessage(
  body: unknown,
  fallback = "Request failed",
): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  const error = record.error;

  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }

  if (typeof record.message === "string") return record.message;
  return fallback;
}
