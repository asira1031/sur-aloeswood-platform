export function PageShell({
  children,
  title,
  eyebrow,
  description,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            {eyebrow && (
              <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">{title}</h1>
            {description && (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-green-100/80">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>
      </section>
      {children}
    </main>
  );
}

export function LoadingCard({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
      <div className="h-4 w-32 animate-pulse rounded-full bg-white/20" />
      <div className="mt-5 space-y-3">
        <div className="h-4 animate-pulse rounded-full bg-white/10" />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-white/10" />
        <div className="h-4 w-3/5 animate-pulse rounded-full bg-white/10" />
      </div>
      <p className="mt-5 text-sm font-bold text-white/60">{text}</p>
    </div>
  );
}

export function EmptyState({
  title = "No records found",
  description = "Once records are available, they will appear here.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
      <p className="text-xl font-black text-green-200">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
    </div>
  );
}

export function AlertMessage({
  message,
  type = "info",
}: {
  message?: string;
  type?: "info" | "success" | "error";
}) {
  if (!message) return null;

  const classes =
    type === "success"
      ? "border-green-300/30 bg-green-400/15 text-green-100"
      : type === "error"
      ? "border-red-300/30 bg-red-400/15 text-red-100"
      : "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";

  return (
    <div className={`rounded-2xl border px-5 py-4 text-sm font-bold ${classes}`}>
      {message}
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none"
    />
  );
}

export function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-xl">
      <p className="text-xs font-black uppercase tracking-wide text-green-100/60">
        {title}
      </p>
      <p className="mt-3 truncate text-2xl font-black text-green-300">{value}</p>
    </div>
  );
}
