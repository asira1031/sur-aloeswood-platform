export type AnyRow = Record<string, any>;

export function taskStatus(status?: string | null) {
  const value = String(status || "ASSIGNED").toUpperCase();

  if (value === "COMPLETED" || value === "DONE") return "COMPLETED";
  if (value === "IN_PROGRESS" || value === "STARTED") return "IN_PROGRESS";
  if (value === "CANCELLED" || value === "FAILED") return "FAILED";

  return "ASSIGNED";
}

export function nextTaskStatus(status?: string | null) {
  const current = taskStatus(status);
  if (current === "ASSIGNED") return "IN_PROGRESS";
  if (current === "IN_PROGRESS") return "COMPLETED";
  return current;
}

export function taskActionLabel(status?: string | null) {
  const current = taskStatus(status);
  if (current === "ASSIGNED") return "Start Task";
  if (current === "IN_PROGRESS") return "Complete Task";
  return "Completed";
}
