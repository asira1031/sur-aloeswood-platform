"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import LogoutButton from "@/app/components/LogoutButton";
import {
  investorLinks,
  formatDate,
  peso,
  statusClass,
  type AnyRow,
} from "@/app/lib/dashboard/nav";
import {
  COPLANTER_PACKAGE_PRICE,
  packagePriceForQuantity,
  projectionDisclaimer,
} from "@/app/lib/business/rules";

type ThemeMode = "FOREST" | "LIGHT" | "GOLD";
type DensityMode = "COMFORTABLE" | "COMPACT";

type Theme = {
  page: string;
  shell: string;
  hero: string;
  surface: string;
  subtle: string;
  text: string;
  muted: string;
  accent: string;
  button: string;
  outline: string;
  line: string;
};

const themes: Record<ThemeMode, Theme> = {
  FOREST: {
    page: "bg-[#f3f7f1] text-slate-950",
    shell: "border-emerald-100 bg-white/88",
    hero: "bg-[radial-gradient(circle_at_top_left,_#d7f4df,_transparent_34%),linear-gradient(135deg,_#0b3b2b,_#12583d_48%,_#f2fff6)]",
    surface: "border-emerald-100 bg-white",
    subtle: "border-emerald-100 bg-emerald-50/70",
    text: "text-slate-950",
    muted: "text-slate-600",
    accent: "text-emerald-700",
    button: "bg-emerald-600 text-white hover:bg-emerald-700",
    outline: "border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50",
    line: "bg-emerald-500",
  },
  LIGHT: {
    page: "bg-slate-50 text-slate-950",
    shell: "border-slate-200 bg-white/90",
    hero: "bg-[linear-gradient(135deg,_#111827,_#334155_48%,_#f8fafc)]",
    surface: "border-slate-200 bg-white",
    subtle: "border-slate-200 bg-slate-100",
    text: "text-slate-950",
    muted: "text-slate-600",
    accent: "text-slate-800",
    button: "bg-slate-950 text-white hover:bg-slate-800",
    outline: "border-slate-200 bg-white text-slate-900 hover:bg-slate-100",
    line: "bg-slate-800",
  },
  GOLD: {
    page: "bg-[#fbf7ed] text-stone-950",
    shell: "border-amber-100 bg-white/90",
    hero: "bg-[radial-gradient(circle_at_top_left,_#ffe7a3,_transparent_33%),linear-gradient(135deg,_#21422f,_#7a5a13_52%,_#fffaf0)]",
    surface: "border-amber-100 bg-white",
    subtle: "border-amber-100 bg-amber-50/75",
    text: "text-stone-950",
    muted: "text-stone-600",
    accent: "text-amber-700",
    button: "bg-amber-500 text-stone-950 hover:bg-amber-400",
    outline: "border-amber-200 bg-white text-stone-900 hover:bg-amber-50",
    line: "bg-amber-500",
  },
};

const primaryNav = [
  "/investor/marketplace",
  "/investor/my-trees",
  "/investor/wallet",
  "/investor/timeline",
  "/certificates",
  "/harvest",
  "/plantation",
  "/legalities",
  "/investor/referrals",
  "/investor/support",
];

const toolCardStyles = [
  "border-emerald-100 bg-white",
  "border-amber-100 bg-amber-50/70",
  "border-green-100 bg-emerald-50/70",
  "border-slate-200 bg-slate-50",
  "border-yellow-100 bg-yellow-50/70",
  "border-teal-100 bg-teal-50/70",
  "border-lime-100 bg-lime-50/70",
  "border-stone-200 bg-stone-50",
];

export default function InvestorDashboardPage() {
  const [email, setEmail] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("FOREST");
  const [densityMode, setDensityMode] = useState<DensityMode>("COMFORTABLE");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [wallet, setWallet] = useState<AnyRow | null>(null);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [notifications, setNotifications] = useState<AnyRow[]>([]);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("sur_login_email") || "";
    const savedTheme = localStorage.getItem("sur_theme_mode") as ThemeMode | null;
    const savedDensity = localStorage.getItem("sur_dashboard_density") as DensityMode | null;

    if (savedTheme && themes[savedTheme]) setThemeMode(savedTheme);
    if (savedDensity === "COMPACT" || savedDensity === "COMFORTABLE") {
      setDensityMode(savedDensity);
    }

    setEmail(savedEmail);
    if (savedEmail) loadDashboard(savedEmail);
  }, []);

  async function loadDashboard(targetEmail = email) {
    const cleanEmail = targetEmail.toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Login first so the dashboard can load your co-planter profile.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data: profileRow, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, account_status, kyc_status, membership_status, wallet_balance, referral_code, created_at"
      )
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !profileRow) {
      setMessage(error?.message || "Profile not found.");
      setProfile(null);
      setLoading(false);
      return;
    }

    const [
      { data: walletRow },
      { data: treeRows },
      { data: purchaseRows },
      { data: noticeRows },
      { data: ticketRows },
    ] = await Promise.all([
      supabase
        .from("wallets")
        .select("id, profile_id, balance, updated_at")
        .eq("profile_id", profileRow.id)
        .maybeSingle(),
      supabase
        .from("tree_registry")
        .select(
          "id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at"
        )
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("seedling_purchases")
        .select("id, profile_id, quantity, amount, status, payment_reference, created_at, approved_at")
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("notifications")
        .select("id, profile_id, title, message, is_read, created_at")
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("support_tickets")
        .select("id, profile_id, subject, message, status, created_at")
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const treeIds = (treeRows || []).map((tree: AnyRow) => tree.id);
    let logRows: AnyRow[] = [];

    if (treeIds.length > 0) {
      const { data } = await supabase
        .from("tree_growth_logs")
        .select("id, profile_id, tree_id, tree_code, height_cm, diameter_cm, health_status, remarks, photo_url, created_at")
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false });

      logRows = (data || []) as AnyRow[];
    }

    setProfile(profileRow);
    setWallet(walletRow || null);
    setTrees((treeRows || []) as AnyRow[]);
    setLogs(logRows);
    setPurchases((purchaseRows || []) as AnyRow[]);
    setNotifications((noticeRows || []) as AnyRow[]);
    setTickets((ticketRows || []) as AnyRow[]);
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", profileRow.id);
    setLoading(false);
  }

  const theme = themes[themeMode];
  const compact = densityMode === "COMPACT";
  const pendingPurchases = purchases.filter(
    (purchase) => String(purchase.status || "").toUpperCase() === "PENDING"
  ).length;
  const unread = notifications.filter((notice) => !notice.is_read).length;
  const openTickets = tickets.filter((ticket) => String(ticket.status || "").toUpperCase() === "OPEN").length;
  const activeTrees = trees.filter((tree) => String(tree.status || "").toUpperCase() !== "DAMAGED").length;
  const portfolioValue = packagePriceForQuantity(trees.length);
  const walletValue = Number(wallet?.balance ?? profile?.wallet_balance ?? 0);
  const totalPurchased = purchases.reduce((sum, purchase) => sum + Number(purchase.amount || 0), 0);
  const initialLoading = loading && !profile;
  const loadingValue = (value: string) => (initialLoading ? "Loading" : value);
  const latestPurchase = purchases[0];
  const latestTree = trees[0];
  const latestLog = logs[0];
  const referralLink =
    typeof window !== "undefined" && profile?.referral_code
      ? `${window.location.origin}/register?ref=${profile.referral_code}`
      : "";
  const featureLinks = investorLinks.filter((link) => primaryNav.includes(link.href));

  const healthItems = [
    {
      label: "Account review",
      value: profile?.account_status || "PENDING",
      detail: "Admin account status",
    },
    {
      label: "KYC check",
      value: profile?.kyc_status || "PENDING",
      detail: "Identity review stage",
    },
    {
      label: "Membership",
      value: profile?.membership_status || "PENDING",
      detail: "Co-planter status",
    },
  ];

  const activityItems = [
    latestPurchase && {
      title: "Latest package order",
      detail: `${latestPurchase.status || "PENDING"} - ${peso(latestPurchase.amount || 0)}`,
      date: formatDate(latestPurchase.created_at),
      href: "/investor/marketplace",
    },
    latestTree && {
      title: "Latest AG tree record",
      detail: latestTree.tree_code || "Pending AG Code",
      date: formatDate(latestTree.created_at),
      href: "/investor/my-trees",
    },
    latestLog && {
      title: "Latest growth update",
      detail: latestLog.health_status || latestLog.remarks || "Growth update",
      date: formatDate(latestLog.created_at),
      href: "/investor/timeline",
    },
  ].filter(Boolean) as Array<{ title: string; detail: string; date: string; href: string }>;

  return (
    <main className={`min-h-screen ${theme.page}`}>
      <div className="mx-auto flex w-full max-w-[1500px] gap-6 px-4 py-4 lg:px-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 overflow-hidden rounded-[2rem] border border-white/20 p-5 text-white shadow-sm xl:block">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/forest-bg.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-green-950/88 via-green-950/76 to-black/78" />
          <div className="relative z-10">
            <Link href="/" className="flex items-center gap-3">
              <img src="/sur-logo.png" alt="SUR Aloeswood" className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/30" />
              <div>
                <p className="text-sm font-black">SUR Aloeswood</p>
                <p className="text-xs font-bold text-white/65">Co-Planter Portal</p>
              </div>
            </Link>

            <nav className="mt-8 space-y-2">
              {featureLinks.slice(0, 7).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-sm font-black text-white backdrop-blur transition hover:border-white/30 hover:bg-white/18"
                >
                  <span>{link.title}</span>
                  <span className="text-white/55">›</span>
                </Link>
              ))}
            </nav>

            <div className="mt-8 rounded-2xl border border-white/16 bg-white/12 p-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-100">Package Price</p>
              <p className="mt-2 text-2xl font-black">{peso(COPLANTER_PACKAGE_PRICE)}</p>
              <p className="mt-2 text-xs leading-5 text-white/65">Current co-planter package reference.</p>
            </div>

            <LogoutButton className="mt-4 w-full rounded-2xl border border-red-300/25 bg-red-500/15 px-4 py-3 text-sm font-black text-red-50 backdrop-blur transition hover:bg-red-500/25 disabled:opacity-60" />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('/forest-bg.jpg')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-green-950/88 via-green-900/62 to-green-950/18" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">
                  Investor Command Center
                </p>
                <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                  {profile?.full_name ? `Welcome, ${profile.full_name.split(" ")[0]}` : "Co-Planter Dashboard"}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                  Monitor your package activity, AG tree records, wallet balance, support, and plantation updates from a single investor workspace.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => loadDashboard()}
                  disabled={loading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
                <Link
                  href="/investor/settings"
                  aria-label="Open investor settings"
                  title="Settings"
                  className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-[0px] font-black text-white backdrop-blur before:text-sm before:content-['Settings'] hover:bg-white/20"
                >
                  ⚙
                </Link>
              </div>
            </div>

            <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-3">
              <HeroStat label="Wallet Balance" value={loadingValue(peso(walletValue))} />
              <HeroStat label="Portfolio Reference" value={loadingValue(peso(portfolioValue))} />
              <HeroStat label="AG Trees" value={loadingValue(`${activeTrees}/${trees.length}`)} />
            </div>

            {message && (
              <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
                {message}
              </div>
            )}
          </section>

          <section className={`grid gap-4 py-5 md:grid-cols-2 ${compact ? "xl:grid-cols-6" : "xl:grid-cols-4"}`}>
            <Metric tone="gold" title="Total Purchased" value={loadingValue(peso(totalPurchased))} detail="Recorded package payments" />
            <Metric tone="forest" title="Pending Orders" value={loadingValue(String(pendingPurchases))} detail="Awaiting admin review" />
            <Metric tone="white" title="Unread Alerts" value={loadingValue(String(unread))} detail="Notifications to review" />
            <Metric tone="mist" title="Open Support" value={loadingValue(String(openTickets))} detail="Active help tickets" />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className={`text-2xl font-black ${theme.text}`}>Portfolio Workspace</h2>
                  <p className={`mt-1 text-sm ${theme.muted}`}>Core tools for monitoring and managing your co-planter account.</p>
                </div>
              </div>

              <div className={`grid gap-4 ${compact ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                {featureLinks.map((link, index) => (
                  <Link key={link.href} href={link.href} className={`group rounded-[1.6rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toolCardStyles[index % toolCardStyles.length]}`}>
                    <div className={`h-1.5 w-14 rounded-full ${theme.line}`} />
                    <div className="mt-5 flex items-start justify-between gap-4">
                      <p className={`text-lg font-black ${theme.text}`}>{link.title}</p>
                      <span className={`rounded-full px-3 py-1 text-sm font-black ${theme.accent}`}>›</span>
                    </div>
                    <p className={`mt-2 text-sm leading-6 ${theme.muted}`}>{link.desc}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <section className={`rounded-[2rem] border p-5 shadow-sm lg:p-6 ${theme.surface}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className={`text-2xl font-black ${theme.text}`}>Account Readiness</h2>
                    <p className={`mt-1 text-sm ${theme.muted}`}>Review status from your profile record.</p>
                  </div>
                  <Link href="/investor/profile" className={`rounded-xl border px-3 py-2 text-xs font-black ${theme.outline}`}>
                    Profile
                  </Link>
                </div>

                <div className="mt-5 space-y-3">
                  {healthItems.map((item) => (
                    <div key={item.label} className={`rounded-2xl border p-4 ${theme.subtle}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className={`text-sm font-black ${theme.text}`}>{item.label}</p>
                          <p className={`mt-1 text-xs ${theme.muted}`}>{item.detail}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.value)}`}>
                          {item.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`rounded-[2rem] border p-5 shadow-sm lg:p-6 ${theme.surface}`}>
                <h2 className={`text-2xl font-black ${theme.text}`}>Recent Activity</h2>
                <div className="mt-5 space-y-3">
                  {activityItems.map((item) => (
                    <Link key={`${item.title}-${item.date}`} href={item.href} className={`block rounded-2xl border p-4 ${theme.subtle}`}>
                      <p className={`text-sm font-black ${theme.text}`}>{item.title}</p>
                      <p className={`mt-1 text-sm ${theme.muted}`}>{item.detail}</p>
                      <p className={`mt-2 text-xs font-bold ${theme.accent}`}>{item.date}</p>
                    </Link>
                  ))}
                  {activityItems.length === 0 && <Empty theme={theme} text="No recent activity yet." />}
                </div>
              </section>

              <section className={`rounded-[2rem] border p-5 shadow-sm lg:p-6 ${theme.surface}`}>
                <h2 className={`text-2xl font-black ${theme.text}`}>Referral</h2>
                <p className={`mt-1 text-sm leading-6 ${theme.muted}`}>Share after your account is approved.</p>
                <div className={`mt-4 break-all rounded-2xl border p-4 text-xs font-bold ${theme.subtle} ${theme.muted}`}>
                  {referralLink || "Referral link appears after profile load."}
                </div>
              </section>
            </div>
          </section>

          <section className={`mt-5 rounded-[2rem] border p-5 shadow-sm lg:p-6 ${theme.surface}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className={`text-2xl font-black ${theme.text}`}>AG Tree Snapshot</h2>
                <p className={`mt-1 text-sm ${theme.muted}`}>Latest tree records and growth updates from plantation operations.</p>
              </div>
              <Link href="/investor/my-trees" className={`rounded-2xl border px-4 py-3 text-sm font-black ${theme.outline}`}>
                View All Trees
              </Link>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {trees.slice(0, compact ? 3 : 5).map((tree) => (
                  <Link key={tree.id} href="/investor/my-trees" className={`block rounded-2xl border p-4 ${theme.subtle}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`font-black ${theme.text}`}>{tree.tree_code || "Pending AG Code"}</p>
                        <p className={`mt-1 text-xs ${theme.muted}`}>
                          {tree.denr_tag_number || "DENR pending"} - {formatDate(tree.planted_at)}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(tree.status)}`}>
                        {tree.status || "REGISTERED"}
                      </span>
                    </div>
                  </Link>
                ))}
                {trees.length === 0 && <Empty theme={theme} text="No AG trees yet." />}
              </div>

              <div className="space-y-3">
                {logs.slice(0, compact ? 3 : 5).map((log) => (
                  <div key={log.id} className={`rounded-2xl border p-4 ${theme.subtle}`}>
                    <p className={`font-black ${theme.text}`}>{log.health_status || "Growth Update"}</p>
                    <p className={`mt-1 text-sm ${theme.muted}`}>{log.remarks || "-"}</p>
                    <p className={`mt-2 text-xs font-bold ${theme.accent}`}>{formatDate(log.created_at)}</p>
                  </div>
                ))}
                {logs.length === 0 && <Empty theme={theme} text="No growth updates yet." />}
              </div>
            </div>
          </section>

          <section className="py-5">
            <p className={`rounded-2xl border px-5 py-4 text-xs leading-6 ${theme.subtle} ${theme.muted}`}>
              {projectionDisclaimer}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{label}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Metric({
  tone,
  title,
  value,
  detail,
}: {
  tone: "gold" | "forest" | "white" | "mist";
  title: string;
  value: string;
  detail: string;
}) {
  const styles = {
    gold: "border-amber-100 bg-gradient-to-br from-white via-amber-50 to-yellow-50 text-amber-900",
    forest: "border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-green-50 text-emerald-900",
    white: "border-slate-200 bg-white text-slate-950",
    mist: "border-teal-100 bg-gradient-to-br from-white via-teal-50 to-emerald-50 text-teal-900",
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${styles}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-65">{title}</p>
      <p className="mt-3 truncate text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm opacity-70">{detail}</p>
    </div>
  );
}

function Empty({ theme, text }: { theme: Theme; text: string }) {
  return (
    <div className={`rounded-2xl border border-dashed p-5 text-sm font-bold ${theme.subtle} ${theme.muted}`}>
      {text}
    </div>
  );
}
