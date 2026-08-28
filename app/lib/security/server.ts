import "server-only";

import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RateBucket = { count: number; resetAt: number };

const globalBuckets = globalThis as typeof globalThis & {
  __surRateBuckets?: Map<string, RateBucket>;
};

const buckets = globalBuckets.__surRateBuckets ?? new Map<string, RateBucket>();
globalBuckets.__surRateBuckets = buckets;

export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowMs: number,
) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientId = forwarded || request.headers.get("x-real-ip") || "unknown";
  const key = `${scope}:${clientId}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function enforceDurableRateLimit(request: NextRequest, scope: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfterSeconds: number; unavailable?: boolean }> {
  const local = enforceRateLimit(request, scope, limit, windowSeconds * 1000);
  if (!local.allowed) return local;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const unavailable = { allowed: false, retryAfterSeconds: 60, unavailable: true };
  if (!url || !service) return unavailable;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientId = forwarded || request.headers.get("x-real-ip") || "unknown";
  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await db.rpc("sur_consume_api_rate_limit", { p_bucket_key: `${scope}:${clientId}`, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) return unavailable;
  const result = data as { allowed?: boolean; reset_at?: string } | null;
  if (typeof result?.allowed !== "boolean") return unavailable;
  const retry = result?.reset_at ? Math.max(1, Math.ceil((new Date(result.reset_at).getTime() - Date.now()) / 1000)) : windowSeconds;
  return { allowed: result.allowed, retryAfterSeconds: result.allowed ? 0 : retry };
}

export function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.toLowerCase().startsWith("bearer ") ? authorization : "";
}

export function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace("CO_PLANTER", "COPLANTER");
}
