// One place for talking to the Kadence API (server/app.ts, proxied by Vite at /api).
// Every failure becomes an ApiError whose message is safe to show the student: 4xx responses
// explain what to fix, 5xx and network failures get a generic retry message.

export class ApiError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

export async function request<T = unknown>(
  path: string,
  failureMessage: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      ...(json !== undefined && {
        headers: { "Content-Type": "application/json", ...rest.headers },
        body: JSON.stringify(json),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(
      `${failureMessage} Kadence couldn't reach the server. Check your connection and try again.`,
      null,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const serverMessage =
      typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : null;
    throw new ApiError(
      response.status < 500 && serverMessage
        ? `${failureMessage} ${serverMessage}`
        : `${failureMessage} Please try again in a moment.`,
      response.status,
    );
  }
  return body as T;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  return error instanceof Error && error.message ? error.message : fallback;
}
