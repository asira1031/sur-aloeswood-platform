export type AppResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; data: null; message: string };

export function ok<T>(data: T, message?: string): AppResult<T> {
  return { ok: true, data, message };
}

export function fail(message = "Request failed."): AppResult<never> {
  return { ok: false, data: null, message };
}

export function fromSupabase<T>(
  data: T,
  error: any,
  fallback = "Database request failed."
): AppResult<T> {
  if (error) return fail(error.message || fallback);
  return ok(data);
}