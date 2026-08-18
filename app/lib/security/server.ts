import "server-only";

import type { NextRequest } from "next/server";

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

export function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.toLowerCase().startsWith("bearer ") ? authorization : "";
}

export function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace("CO_PLANTER", "COPLANTER");
}
