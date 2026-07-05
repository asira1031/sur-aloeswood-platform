export type LaunchStatus = "PASS" | "NEEDS_SQL" | "NEEDS_ENV" | "NEEDS_UAT";

export type LaunchChecklistItem = {
  area: string;
  status: LaunchStatus;
  title: string;
  detail: string;
};

export const launchChecklist: LaunchChecklistItem[] = [
  {
    area: "Build",
    status: "PASS",
    title: "Production build",
    detail: "Next.js production build passes locally with all current app routes.",
  },
  {
    area: "Wallet",
    status: "NEEDS_ENV",
    title: "Server wallet purchase key",
    detail: "Set SUPABASE_SERVICE_ROLE_KEY in local and Vercel server environment for protected wallet seedling purchase.",
  },
  {
    area: "Database",
    status: "NEEDS_SQL",
    title: "RLS policy hardening",
    detail: "Replace broad anon policies with authenticated user/admin policies before real customers use the platform.",
  },
  {
    area: "Auth",
    status: "NEEDS_UAT",
    title: "Role login UAT",
    detail: "Test Admin, Co-Planter, and Farmer login redirects, protected routes, and logout on real accounts.",
  },
  {
    area: "Co-Planter",
    status: "NEEDS_UAT",
    title: "Customer purchase flow",
    detail: "Test wallet cash-in, admin treasury approval, wallet seedling purchase, admin AG tree approval, and My AG Trees visibility.",
  },
  {
    area: "Farmer",
    status: "NEEDS_UAT",
    title: "Farmer field loop",
    detail: "Test admin farmer invite, farmer login, assigned tree access, task completion, growth logs, and photo updates.",
  },
  {
    area: "Support",
    status: "NEEDS_UAT",
    title: "Hybrid support flow",
    detail: "Test investor chat, AI answer, admin escalation, ticket conversion, admin reply, and notification delivery.",
  },
  {
    area: "Legal",
    status: "PASS",
    title: "Company Profile legalities",
    detail: "Company Profile pages 57-78 are available in the Legalities library with direct document viewer links.",
  },
  {
    area: "Deploy",
    status: "NEEDS_UAT",
    title: "Vercel production deploy",
    detail: "After SQL/env hardening, deploy to Vercel and run smoke tests against the production URL.",
  },
];

export function launchSummary() {
  return {
    pass: launchChecklist.filter((item) => item.status === "PASS").length,
    needsEnv: launchChecklist.filter((item) => item.status === "NEEDS_ENV").length,
    needsSql: launchChecklist.filter((item) => item.status === "NEEDS_SQL").length,
    needsUat: launchChecklist.filter((item) => item.status === "NEEDS_UAT").length,
  };
}
