import "server-only";

import type { NextRequest } from "next/server";

export const GUARDIAN_PROJECT_NAME = "sur-aloeswood-platform";
export const GUARDIAN_PROJECT_ROOT = process.cwd();

export type FeatureBrief = {
  name: string;
  purpose: string;
  users: string;
  behavior: string;
  data: string;
  restrictions: string;
};

export function isLocalGuardianRequest(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  return process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "::1"].includes(host);
}

export function normalizeBrief(input: unknown): FeatureBrief {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const read = (key: keyof FeatureBrief, max: number) => String(body[key] || "").trim().slice(0, max);
  return {
    name: read("name", 120), purpose: read("purpose", 1_500), users: read("users", 500),
    behavior: read("behavior", 3_000), data: read("data", 1_500), restrictions: read("restrictions", 1_500),
  };
}

export function validateBrief(brief: FeatureBrief) {
  const missing = (["name", "purpose", "users", "behavior"] as const).filter((key) => !brief[key]);
  return missing.length ? [`Missing required fields: ${missing.join(", ")}.`] : [];
}

export function buildPlan(brief: FeatureBrief) {
  return {
    classification: "OWNER BRIEF — IMPLEMENTATION REQUIRES CODE REVIEW",
    summary: `${brief.name}: ${brief.purpose}`,
    phases: [
      { number: 1, title: "Discovery", work: "Trace existing pages, roles, API routes, database contracts, and tests touched by the request." },
      { number: 2, title: "Design", work: "Define UI states, authorization, validation, data changes, migration/rollback, and acceptance criteria." },
      { number: 3, title: "Implementation", work: "Codex edits only the SUR repository and prepares any database migration as a separately reviewable file." },
      { number: 4, title: "Verification", work: "Run focused tests, security contracts, lint, production build, and local role-based smoke/E2E checks." },
      { number: 5, title: "Release", work: "Show diff and evidence; deploy only after owner approval, then verify the deployed commit and workflow." },
    ],
    acceptanceChecklist: [
      `Intended users: ${brief.users}`,
      `Expected behavior: ${brief.behavior}`,
      `Data impact: ${brief.data || "Must be discovered before implementation"}`,
      `Explicit restrictions: ${brief.restrictions || "No additional owner restriction supplied"}`,
      "No unrelated project, client, database, secret, or deployment may be touched.",
    ],
  };
}

export function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "feature";
}
