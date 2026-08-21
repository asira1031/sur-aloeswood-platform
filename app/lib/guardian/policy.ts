import "server-only";

export const SUR_PROJECT_REF = "dvidrbhfzzhgwyempgtu";
export const WRITE_CONFIRMATION = "EXECUTE SUR WRITE";

export type GuardianAnalysis = { allowed: boolean; kind: "READ" | "WRITE" | "UNKNOWN"; normalizedSql: string; reasons: string[] };

const blocked = [
  /\b(auth|storage|vault|extensions|realtime|pg_catalog|information_schema)\s*\./i,
  /\b(drop|truncate|alter|create|grant|revoke|comment|vacuum|analyze|reindex|cluster)\b/i,
  /\b(copy|do|call|execute|prepare|deallocate|listen|notify|set|reset|show)\b/i,
  /\b(pg_|dblink|lo_|current_setting|set_config|http_|net\.)/i,
  /\bfor\s+(update|share)\b/i,
];

export function analyzeGuardianSql(input: string): GuardianAnalysis {
  const reasons: string[] = [];
  let sql = String(input || "").trim();
  if (sql.endsWith(";")) sql = sql.slice(0, -1).trim();
  if (!sql) reasons.push("SQL is required.");
  if (sql.length > 12_000) reasons.push("SQL exceeds 12,000 characters.");
  if (sql.includes(";") || /--|\/\*|\*\/|\$\$/i.test(sql)) reasons.push("Multiple statements, comments, and dollar quoting are blocked.");
  for (const pattern of blocked) if (pattern.test(sql)) reasons.push("Blocked schema, command, or database capability detected.");
  const first = sql.match(/^([a-z]+)/i)?.[1]?.toUpperCase();
  const kind = first === "SELECT" ? "READ" : ["INSERT", "UPDATE", "DELETE"].includes(first || "") ? "WRITE" : "UNKNOWN";
  if (kind === "UNKNOWN") reasons.push("Only SELECT, INSERT, UPDATE, or DELETE is allowed.");
  if (/\breturning\b/i.test(sql)) reasons.push("RETURNING is blocked; verify with a separate SELECT.");
  return { allowed: reasons.length === 0, kind, normalizedSql: sql, reasons: [...new Set(reasons)] };
}

export function isSurProject(url?: string) {
  try { return new URL(String(url || "")).hostname === `${SUR_PROJECT_REF}.supabase.co`; }
  catch { return false; }
}
