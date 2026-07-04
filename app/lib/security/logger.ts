type LogLevel = "info" | "warn" | "error";

function shouldLog() {
  return process.env.NODE_ENV !== "production";
}

export function appLog(level: LogLevel, label: string, data?: unknown) {
  if (!shouldLog()) return;

  const prefix = `[SUR:${level.toUpperCase()}] ${label}`;

  if (level === "error") console.error(prefix, data || "");
  else if (level === "warn") console.warn(prefix, data || "");
  else console.log(prefix, data || "");
}

export function normalizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error occurred.";
}
